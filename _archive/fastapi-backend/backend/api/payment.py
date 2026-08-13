import logging
from datetime import datetime, timedelta
from typing import Any, Optional
import stripe

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.core.config import settings
from backend.repository import user as user_repo
from backend.schema.payment import CreateCheckoutSessionRequest
from backend.schema.user import UserResponse
from backend.api.deps import get_current_user
from backend.model.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payment", tags=["payment"])

from sqlalchemy.future import select
from backend.model.support_plan import SupportPlan

@router.post("/create-checkout-session", response_model=Any)
async def create_checkout_session(
    request: Request,
    payload: CreateCheckoutSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建 Stripe 支付会话或执行本地 Mock 降级
    """
    plan_type = payload.plan_type
    period = payload.period

    # 动态从数据库获取支持套餐信息
    result = await db.execute(select(SupportPlan).where(SupportPlan.id == plan_type))
    db_plan = result.scalars().first()
    if not db_plan:
        raise HTTPException(status_code=400, detail="未知的计划类型")

    price_val = db_plan.price_monthly if period == "monthly" else db_plan.price_once
    price_cents = int(round(price_val * 100))
    name = f"OpenBible {db_plan.name} ({'连续每月' if period == 'monthly' else '单次支持'})"

    # 校验是否配置了 Stripe 密钥，如果没有，自动启用本地 Mock 降级
    if not settings.STRIPE_API_KEY:
        logger.info("STRIPE_API_KEY is not configured. Falling back to local Mock payment.")
        origin = request.headers.get("origin") or "http://localhost:8000"
        # 产生一个 Mock 的 success url
        mock_session_id = f"mock_session_{plan_type}_{period}_{int(datetime.utcnow().timestamp())}"
        mock_success_url = f"{origin}/?payment=success&session_id={mock_session_id}"
        return {"url": mock_success_url, "mock": True}

    try:
        stripe.api_key = settings.STRIPE_API_KEY
        origin = request.headers.get("origin") or "http://localhost:8000"

        # 构建支付 Line Item
        line_item = {
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": name,
                    "description": f"获取 {name} 的专属额度与标识",
                },
                "unit_amount": price_cents,
            },
            "quantity": 1,
        }

        # 订阅与单次支付对应不同的 Stripe Mode
        if period == "monthly":
            line_item["price_data"]["recurring"] = {"interval": "month"}
            mode = "subscription"
        else:
            mode = "payment"

        # 创建 Session
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[line_item],
            mode=mode,
            success_url=f"{origin}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/?payment=cancel",
            client_reference_id=str(current_user.id),
            metadata={
                "user_id": str(current_user.id),
                "plan_type": plan_type,
                "period": period
            }
        )
        return {"url": session.url, "mock": False}
    except Exception as e:
        logger.error(f"Failed to create Stripe checkout session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"创建支付会话失败: {str(e)}"
        )

@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> Any:
    """
    接收 Stripe 的 Webhook 回调并更新用户状态
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    event = None

    if settings.STRIPE_API_KEY:
        stripe.api_key = settings.STRIPE_API_KEY

    # 校验 Webhook 签名（配置了 Webhook Secret 且带签名头时）
    if settings.STRIPE_WEBHOOK_SECRET and sig_header:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            raise HTTPException(status_code=400, detail="签名验证失败")
        except Exception as e:
            logger.error(f"Webhook event construct failed: {e}")
            raise HTTPException(status_code=400, detail="事件构建失败")
    elif settings.DEBUG:
        # 仅开发环境(DEBUG)允许跳过验签直接解析 JSON，方便本地调试。
        # 生产环境绝不能走到这里——否则任何人可伪造「支付完成」事件升级套餐。
        logger.warning("Stripe webhook 未验签（DEBUG 模式，仅限本地调试）")
        try:
            import json
            event = json.loads(payload.decode("utf-8"))
        except Exception as e:
            logger.error(f"Failed to parse raw JSON: {e}")
            raise HTTPException(status_code=400, detail="非法的 JSON payload")
    else:
        # 生产环境缺少 Webhook Secret 或签名头 → 拒绝，防止伪造支付事件
        logger.error("Stripe webhook 拒绝：生产环境缺少 STRIPE_WEBHOOK_SECRET 或 stripe-signature 头")
        raise HTTPException(status_code=400, detail="Webhook 未验签，拒绝处理")

    event_type = event.get("type") if isinstance(event, dict) else event.type
    event_data = event.get("data", {}) if isinstance(event, dict) else event.data

    logger.info(f"Received Stripe webhook event: {event_type}")

    if event_type == "checkout.session.completed":
        session = event_data.get("object", {})
        metadata = session.get("metadata", {})
        user_id_str = metadata.get("user_id") or session.get("client_reference_id")

        if user_id_str:
            user_id = int(user_id_str)
            plan_type = metadata.get("plan_type", "free")
            customer_id = session.get("customer")
            sub_id = session.get("subscription")

            # 查找并更新用户计划
            user = await user_repo.get_user_by_id(db, user_id)
            if user:
                # 统一为 30 天有效期
                expires_at = datetime.utcnow() + timedelta(days=30)
                update_data = {
                    "plan": plan_type,
                    "plan_expires_at": expires_at,
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": sub_id
                }
                await user_repo.update_user(db, user, update_data)
                logger.info(f"User {user.email} updated to {plan_type} via webhook.")
            else:
                logger.error(f"User with ID {user_id} not found from webhook metadata.")

    elif event_type == "invoice.payment_succeeded":
        # 订阅续费成功事件
        invoice = event_data.get("object", {})
        sub_id = invoice.get("subscription")
        if sub_id:
            user = await user_repo.get_user_by_subscription_id(db, sub_id)
            if user:
                # 继续顺延 30 天
                new_expires = (user.plan_expires_at or datetime.utcnow()) + timedelta(days=30)
                await user_repo.update_user(db, user, {"plan_expires_at": new_expires})
                logger.info(f"User {user.email} subscription renewed via webhook.")

    elif event_type == "customer.subscription.deleted":
        # 订阅被废弃或欠费取消
        subscription = event_data.get("object", {})
        sub_id = subscription.get("id")
        if sub_id:
            user = await user_repo.get_user_by_subscription_id(db, sub_id)
            if user:
                update_data = {
                    "plan": "free",
                    "plan_expires_at": None,
                    "stripe_subscription_id": None
                }
                await user_repo.update_user(db, user, update_data)
                logger.info(f"User {user.email} subscription deleted. Downgraded to free.")

    return {"status": "success"}

@router.get("/verify-session", response_model=UserResponse)
async def verify_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    验证支付 Session 状态并同步用户状态（前端支付完返回时的双重保证与 Mock 入口）
    """
    # 1. 拦截并处理 Mock 支付逻辑（前缀匹配）
    if session_id.startswith("mock_session_"):
        parts = session_id.split("_")
        # 格式如：mock_session_{plan_type}_{period}_{timestamp}
        plan_type = "free"
        if len(parts) >= 3:
            plan_type = parts[2] # supporter / pro / basic
        
        # 从数据库中验证计划类型是否合法
        val_result = await db.execute(select(SupportPlan).where(SupportPlan.id == plan_type))
        val_plan = val_result.scalars().first()
        if not val_plan:
            plan_type = "free"

        # 触发 Mock 升级
        expires_at = datetime.utcnow() + timedelta(days=30)
        update_data = {
            "plan": plan_type,
            "plan_expires_at": expires_at,
            "stripe_customer_id": f"mock_cust_{current_user.id}",
            "stripe_subscription_id": f"mock_sub_{current_user.id}"
        }
        updated_user = await user_repo.update_user(db, current_user, update_data)
        logger.info(f"Mock user {current_user.email} upgraded to {plan_type} successfully.")
        return updated_user

    # 2. 真实 Stripe 支付会话校验
    if not settings.STRIPE_API_KEY:
        raise HTTPException(status_code=400, detail="未配置 Stripe 密钥，无法验证真实支付")

    try:
        stripe.api_key = settings.STRIPE_API_KEY
        session = stripe.checkout.Session.retrieve(session_id)

        # 确认付款状态
        if session.payment_status != "paid":
             raise HTTPException(status_code=400, detail="该支付账单尚未付款")

        # 读取元数据
        metadata = session.get("metadata", {})
        user_id_str = metadata.get("user_id") or session.get("client_reference_id")
        
        if not user_id_str or int(user_id_str) != current_user.id:
             raise HTTPException(status_code=403, detail="该支付会话不属于当前用户")

        plan_type = metadata.get("plan_type", "free")
        customer_id = session.get("customer")
        sub_id = session.get("subscription")

        # 更新数据库
        expires_at = datetime.utcnow() + timedelta(days=30)
        update_data = {
            "plan": plan_type,
            "plan_expires_at": expires_at,
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": sub_id
        }
        updated_user = await user_repo.update_user(db, current_user, update_data)
        logger.info(f"User {current_user.email} upgraded to {plan_type} via manual verify.")
        return updated_user

    except Exception as e:
        logger.error(f"Failed to verify stripe session: {e}")
        raise HTTPException(status_code=500, detail=f"支付会话校验失败: {str(e)}")

@router.post("/customer-portal")
async def create_portal_session(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    创建 Stripe 客户门户会话；如未配 Stripe 密钥，执行本地 Mock 降级（退订）
    """
    if not settings.STRIPE_API_KEY:
        logger.info(f"Mock cancel subscription for user {current_user.email}")
        # Mock 退订逻辑：直接将用户计划恢复为 free
        update_data = {
            "plan": "free",
            "plan_expires_at": None,
            "stripe_customer_id": None,
            "stripe_subscription_id": None
        }
        await user_repo.update_user(db, current_user, update_data)
        return {"url": None, "mock": True}

    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="未找到您的 Stripe 支付记录，无法创建账单管理会话。"
        )

    try:
        stripe.api_key = settings.STRIPE_API_KEY
        origin = request.headers.get("origin") or "http://localhost:8000"
        
        # 创建 Customer Portal Session
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{origin}/"
        )
        return {"url": session.url, "mock": False}
    except Exception as e:
        logger.error(f"Failed to create stripe billing portal session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"创建账单管理会话失败: {str(e)}"
        )

