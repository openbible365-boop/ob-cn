import asyncio
import httpx
import json
import base64
from backend.core.config import settings

async def main():
    payload = {
        "app": {
            "appid": settings.DOUBAO_APP_ID,
            "token": settings.DOUBAO_ACCESS_TOKEN,
            "cluster": settings.DOUBAO_CLUSTER,
        },
        "user": {"uid": "openbible_tts"},
        "audio": {
            "voice_type": "en_male_jason_conversation_wvae_bigtts",
            "encoding": "mp3"
        },
        "request": {
            "reqid": "test_ts",
            "text": "起初，神创造天地。地是空虚混沌。",
            "text_type": "plain",
            "operation": "query",
            "with_frontend": 1,
            "frontend_type": "unitTson",
        },
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer;{settings.DOUBAO_ACCESS_TOKEN}",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://openspeech.bytedance.com/api/v1/tts", json=payload, headers=headers)
        print(resp.status_code)
        data = resp.json()
        if 'addition' in data:
            print(json.dumps(data['addition'], ensure_ascii=False))

asyncio.run(main())
