"""
Vercel Serverless 函数入口
"""
import os
import sys
import traceback

# 将项目根目录添加到 sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# 1. 显式在顶层声明 app 变量，供 Vercel AST 静态解析器检测
app = None

# 2. 动态安全加载真实应用，并捕获初始化阶段所有错误
try:
    from backend.main import app as main_app
    app = main_app
except BaseException as startup_err:
    tb_str = traceback.format_exc()
    print(f"CRITICAL STARTUP ERROR:\n{tb_str}")
    # 关键：将异常信息存为常规变量，防止 except 块退出时被 Python 自动 del 销毁
    startup_err_msg = str(startup_err)
    
    try:
        # 极简防崩溃 ASGI 垫片：如果主应用加载失败，拦截所有请求直接输出堆栈，防止 Vercel 抛出 FUNCTION_INVOCATION_FAILED 500 错误
        from fastapi import FastAPI
        fallback_app = FastAPI()
        
        @fallback_app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
        async def catch_all_error_api(path: str):
            return {
                "status": "error",
                "message": "FastAPI application failed to load in Vercel Serverless environment.",
                "exception": startup_err_msg,
                "traceback": tb_str.splitlines()
            }
        app = fallback_app
    except BaseException as fallback_err:
        # 极度恶劣环境防线：即便 fastapi 本身都无法加载，也确保 app 决不能为 None。
        # 吐出纯文本 Traceback，保证 Vercel 编译绝不报错，且在运行期把崩溃原因直观展现出来。
        async def extreme_fallback_app(scope, receive, send):
            if scope['type'] == 'http':
                await send({
                    'type': 'http.response.start',
                    'status': 500,
                    'headers': [
                        (b'content-type', b'text/plain; charset=utf-8'),
                    ]
                })
                await send({
                    'type': 'http.response.body',
                    'body': f"FastAPI and Backend failed to load.\nStartup Error:\n{tb_str}\nFallback Error:\n{fallback_err}".encode('utf-8'),
                })
        app = extreme_fallback_app



