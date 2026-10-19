"""
临时调试脚本：直接调用 AI 接口，打印原始返回内容，看 overview 字段为何是 None
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv()

import httpx
from backend.core.config import settings

async def main():
    prompt = """请为《创世记》第1章生成三部分内容：
1. 本章速览：用2-3句话精炼地概述主要内容和核心主题，不超过80字。
2. 启发探索：提出3个发人深省的相关探索问题，每个问题前携带一个适合的emoji（独立字段）。
3. 主题标签：提炼3-5个简短的关键主题词（每个2-4个中文字，直接概括本章核心内容），以数组形式返回。

请严格以JSON格式返回，格式必须如下（不要额外的markdown格式包裹）：
{
  "overview": "速览内容...",
  "explore_chips": [
    {"emoji": "❓", "question": "问题内容..."},
    {"emoji": "💡", "question": "问题内容..."},
    {"emoji": "📖", "question": "问题内容..."}
  ],
  "theme_tags": ["主题1", "主题2", "主题3"]
}"""

    print(f"使用模型: qwen-plus")
    print(f"API Base: {settings.N1N_API_BASE}")
    print("-" * 50)

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.N1N_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.N1N_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "qwen-plus",
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "你是一位圣经学者，善于用简洁有深度的中文进行圣经释义。"},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.7,
            },
        )
    
    print(f"HTTP 状态: {resp.status_code}")
    data = resp.json()
    raw_content = data["choices"][0]["message"]["content"]
    print(f"原始返回内容:\n{raw_content}")
    print("-" * 50)

    import json
    try:
        parsed = json.loads(raw_content.strip(), strict=False)
        print(f"解析后的 keys: {list(parsed.keys())}")
        print(f"overview: {parsed.get('overview')}")
        print(f"theme_tags: {parsed.get('theme_tags')}")
        print(f"explore_chips 数量: {len(parsed.get('explore_chips', []))}")
    except Exception as e:
        print(f"JSON 解析失败: {e}")

asyncio.run(main())
