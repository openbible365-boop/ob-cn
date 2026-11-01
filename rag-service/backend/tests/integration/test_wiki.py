"""wiki 流程集成测试 (需要真 Postgres)。

未设置 KOTTS_TEST_DATABASE_URL 时, db_session 上游 need_db fixture 会 skip。
"""

import pytest
from httpx import AsyncClient
from app.models import WikiPage, WikiJob


async def test_wiki_crud_flow(client: AsyncClient, user, admin, make_token, db_session):
    user_token = make_token(user)
    admin_token = make_token(admin)

    # 1. 列表空态
    r = await client.get("/wiki/pages", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    assert r.json() == []

    # 2. 普通用户创建 Wiki 页面
    r = await client.post(
        "/wiki/pages",
        headers={"Authorization": f"Bearer {user_token}"},
        json={
            "title": "因信称义",
            "content": "# 因信称义\n这是关于[[信仰]]的核心教义。"
        }
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "因信称义"
    assert "信仰" in body["content"]
    assert body["summary"] == "这是关于信仰的核心教义。"

    # 3. 列表查询（搜索标题和内容）
    r = await client.get("/wiki/pages?query=称义", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["title"] == "因信称义"

    # 4. 根据标题查询（by-title）
    r = await client.get("/wiki/pages/by-title?title=因信称义", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    assert r.json()["title"] == "因信称义"

    # 4b. 根据不存在的标题查询 -> 404
    r = await client.get("/wiki/pages/by-title?title=不存在的词条", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 404

    # 5. 更新 Wiki 页面
    r = await client.post(
        "/wiki/pages",
        headers={"Authorization": f"Bearer {user_token}"},
        json={
            "title": "因信称义",
            "content": "# 因信称义\n这是关于[[耶稣]]的核心教义。最新修改内容。"
        }
    )
    assert r.status_code == 200
    assert "最新修改内容" in r.json()["content"]

    # 6. 删除 Wiki 页面 - 普通用户尝试删除 -> 403
    page_id = r.json()["id"]
    r = await client.delete(f"/wiki/pages/{page_id}", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 403

    # 7. 删除 Wiki 页面 - Admin 删除 -> 204
    r = await client.delete(f"/wiki/pages/{page_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 204

    # 验证真的删了
    r = await client.get("/wiki/pages", headers={"Authorization": f"Bearer {user_token}"})
    assert r.json() == []
