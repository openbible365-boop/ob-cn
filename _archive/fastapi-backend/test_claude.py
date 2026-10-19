import asyncio
from backend.core.config import settings
import httpx
import json

async def run():
    model_name = "claude-3-5-sonnet-20240620"
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
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.N1N_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {settings.N1N_API_KEY}"},
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "你是一位圣经学者，善于用简洁有深度的中文进行圣经释义。"},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.7,
            },
        )
    data = resp.json()
    raw = data["choices"][0]["message"]["content"]
    print("---RAW OUTPUT---")
    print(raw)
    print("---END RAW---")
    try:
        json.loads(raw.strip())
        print("PARSE SUCCESS")
    except Exception as e:
        print("PARSE FAILED:", str(e))

asyncio.run(run())
