import httpx
from backend.core.config import settings

async def explain_verse(verse_ref: str, verse_text: str = "", study_context: str = "") -> dict:
    """
    通过 Gemini API 请求经文解析。
    verse_ref 类似 'gen-1-1'。
    verse_text 为前端传来的经文内容辅助提示（如果有）。
    study_context 为精读本中关于该经文的注释解析（如果有）。
    """
    if not settings.N1N_API_KEY:
        return {"text": f"系统未配置 N1N_API_KEY，无法调用 AI API 获取 [{verse_ref}] 的真实解析。", "tokens_in": 0, "tokens_out": 0}
    
    system_prompt = "请作为一位资深的圣经学者，为经文提供深入的、有灵修价值的解析（150-200字即可）。直接用中文作答，不需要客套话。"
    user_content = f"需要解析的经文是：'{verse_ref}'。"
    if verse_text:
        user_content += f"\n\n经文内容是：{verse_text}。"
    if study_context:
        user_content += f"\n\n参考解析和背景资料（请融合这些重点）：\n{study_context}"
        
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.N1N_API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.N1N_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": settings.N1N_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.7
                }
            )
            resp.raise_for_status()
            data = resp.json()
            answer = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return {"text": answer, "tokens_in": usage.get("prompt_tokens", 0), "tokens_out": usage.get("completion_tokens", 0), "prompt": user_content}
    except Exception as e:
        return {"text": f"大模型生成失败: {str(e)}", "tokens_in": 0, "tokens_out": 0, "prompt": user_content}


async def ask_bible_question(question: str, context: str = "", stage_level: int = 2, version: str = "cuv") -> tuple[str, str]:
    """
    通过 n1n.ai（OpenAI 兼容接口）回答圣经相关问题。
    根据用户灵命阶段自动路由模型：
      - level 5（教牧人员/资深圣经教师）、level 6（神学研究人员） → Claude
      - 其他阶段（1-4） → Grok

    Args:
        question: 用户问题
        context: 可选的上下文（如当前阅读的经文引用）
        stage_level: 用户灵命阶段等级（1-6），默认 2
        version: 当前查看的圣经版本
    Returns:
        (AI 回答文本, 实际使用的模型名称)
    """
    if not settings.N1N_API_KEY:
        return "系统未配置 N1N_API_KEY，暂时无法调用 AI 服务。请联系管理员配置 n1n.ai API Key。", "none"

    # NOTE: 统一使用 Qwen Plus 模型，免去按用户阶段分流的复杂性
    model_name = "qwen-plus"

    if version == "kjv":
        system_prompt = (
            "You are a warm and approachable Bible guide, balancing theology with practical devotion. "
            "Please answer the question concisely and empathetically in English (150-280 words). "
            "Integrate the biblical context with real-life scenarios, encouraging the reader to apply truths in their daily life. "
            "Answer directly without pleasantries."
        )
    elif version in ("keb", "krv", "snr"):
        system_prompt = (
            "당신은 신학과 실천적 경건의 균형을 잘 아는 따뜻하고 친절한 성경 안내자입니다. "
            "질문에 대해 간결하고 공감할 수 있는 한국어로 대답해주세요 (150-280자). "
            "성경 원문의 문맥과 실제 생활 상황을 연결하여, 독자가 진리를 일상에 적용하도록 격려해 주세요. "
            "인사말 없이 바로 답변해 주세요."
        )
    else:
        system_prompt = (
            "你是一位温和亲切的圣经引导者，懂得兼顾神学与实践情怀并重。"
            "请用简洁、有共鸣感的中文回答问题（150-280字），"
            "结合圣经原文语境与实际生活场景，鼓励读者将真理应用在日常生活中。"
            "直接作答，不要客套。"
        )

    user_content = question
    if context:
        user_content = f"【当前阅读经文】{context}\n\n【问题】{question}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.N1N_API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.N1N_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "max_tokens": 600,
                    "temperature": 0.7,
                },
            )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip(), model_name
    except httpx.HTTPStatusError as e:
        return f"API 请求失败（{e.response.status_code}）：{e.response.text[:200]}", model_name
    except Exception as e:
        return f"AI 服务暂时不可用：{str(e)}", model_name

from sqlalchemy.ext.asyncio import AsyncSession
from backend.repository.book import get_book_by_code

import json

async def generate_chapter_summary(db: AsyncSession, book_code: str, chapter: int) -> dict:
    """自动生成某个章节的速览、启发探索列表及主题标签"""
    return await generate_chapter_summary_with_model(db, book_code, chapter, "qwen-plus")


async def generate_chapter_summary_with_model(
    db: AsyncSession,
    book_code: str,
    chapter: int,
    model_name: str,
    version: str = "cuv",
) -> dict:
    """
    使用指定模型生成章节速览、主题标签与启发探索问题。
    供评测接口并发调用，不写入数据库缓存。

    Args:
        db: 数据库会话（用于获取书卷全名）
        book_code: 书卷代码，如 'gen'
        chapter: 章节号
        model_name: 要使用的模型名称，如 'gpt-4o-mini'、'grok-3'

    Returns:
        包含 overview / explore_chips / theme_tags 的字典
    """
    book = await get_book_by_code(db, book_code, version)
    book_name = book.full_name if book else book_code

    # NOTE: 根据圣经版本确定输出语言（cuv/cnvs→中文, kjv→英文, keb/krv→韩文）
    if version == "kjv":
        system_prompt = "You are a Bible scholar skilled at concise, insightful commentary in English."
        prompt = (
            f"Please generate three sections for {book_name} Chapter {chapter}:\n"
            "1. Chapter Overview: A concise 2-3 sentence summary of the main content and core themes (max 80 words).\n"
            "2. Explore Questions: 3 thought-provoking questions, each prefixed with a suitable emoji (separate field).\n"
            "3. Theme Tags: 3-5 short keyword tags (2-4 words each) capturing the chapter's key topics.\n\n"
            "Return strictly as JSON (no markdown wrapper):\n"
            '{{\n'
            '  "overview": "...",\n'
            '  "explore_chips": [\n'
            '    {{"emoji": "❓", "question": "..."}},\n'
            '    {{"emoji": "💡", "question": "..."}},\n'
            '    {{"emoji": "📖", "question": "..."}}\n'
            '  ],\n'
            '  "theme_tags": ["Tag1", "Tag2", "Tag3"]\n'
            '}}\n\n'
            "Important: escape any double quotes inside JSON values with a backslash."
        )
    elif version in ("keb", "krv", "snr"):
        system_prompt = "당신은 성경 학자로, 간결하고 깊이 있는 한국어 성경 해설을 잘합니다."
        prompt = (
            f"《{book_name}》 {chapter}장에 대해 세 가지 내용을 생성해 주세요:\n"
            "1. 장 개요: 주요 내용과 핵심 주제를 2-3문장으로 간결하게 요약 (80자 이내).\n"
            "2. 탐구 질문: 깊이 생각할 수 있는 질문 3가지, 각 질문 앞에 적절한 이모지 포함 (별도 필드).\n"
            "3. 주제 태그: 본 장의 핵심 내용을 담은 짧은 키워드 3-5개 (각 2-4글자).\n\n"
            "반드시 아래 JSON 형식으로만 반환 (마크다운 래퍼 없음):\n"
            '{{\n'
            '  "overview": "...",\n'
            '  "explore_chips": [\n'
            '    {{"emoji": "❓", "question": "..."}},\n'
            '    {{"emoji": "💡", "question": "..."}},\n'
            '    {{"emoji": "📖", "question": "..."}}\n'
            '  ],\n'
            '  "theme_tags": ["태그1", "태그2", "태그3"]\n'
            '}}\n\n'
            "중요: JSON 문자열 값 안의 큰따옴표는 반드시 백슬래시로 이스케이프해 주세요."
        )
    else:
        # 默认中文（cuv / cnvs）
        system_prompt = "你是一位圣经学者，善于用简洁有深度的中文进行圣经释义。"
        prompt = (
            f"请为《{book_name}》第{chapter}章生成三部分内容：\n"
            "1. 本章速览：用2-3句话精炼地概述主要内容和核心主题，不超过80字。\n"
            "2. 启发探索：提出3个发人深省的相关探索问题，每个问题前携带一个适合的emoji（独立字段）。\n"
            "3. 主题标签：提炼3-5个简短的关键主题词（每个2-4个中文字，直接概括本章核心内容），以数组形式返回。\n\n"
            "请严格以JSON格式返回，格式必须如下（不要额外的markdown格式包裹）：\n"
            '{{\n'
            '  "overview": "速览内容...",\n'
            '  "explore_chips": [\n'
            '    {{"emoji": "❓", "question": "问题内容..."}},\n'
            '    {{"emoji": "💡", "question": "问题内容..."}},\n'
            '    {{"emoji": "📖", "question": "问题内容..."}}\n'
            '  ],\n'
            '  "theme_tags": ["主题1", "主题2", "主题3"]\n'
            '}}\n\n'
            "重要提示：生成的 JSON 字段值中如果包含双引号，请必须使用反斜杠转义，"
            "或统一使用中文双引号（\u201c\u201d），以保证返回的是合法的 JSON 字符串！"
        )

    if not settings.N1N_API_KEY:
        return {
            "overview": "系统未配置 N1N_API_KEY，无法调用 AI。",
            "explore_chips": [],
            "theme_tags": []
        }

    try:
        import time
        start = time.time()
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.N1N_API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.N1N_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    # NOTE: 不指定 response_format=json_object，让模型自由返回含 JSON 的文本，
                    # 再由下面的清理逻辑提取，兼容 qwen-plus 等对 json_object 格式支持不稳定的模型
                    "messages": [
                        {
                            "role": "system",
                            "content": system_prompt
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.7,
                },
            )
        latency_ms = int((time.time() - start) * 1000)
        resp.raise_for_status()
        data = resp.json()
        raw_answer = data["choices"][0]["message"]["content"].strip()
        

        # 移除 markdown block
        cleaned = raw_answer
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
            
        # 提取第一个 { ... } JSON 块（防止模型在 JSON 前后添加多余文字）
        import re
        json_match = re.search(r'\{[\s\S]*\}', cleaned)
        if json_match:
            cleaned = json_match.group(0)

        # 移除多余的尾随逗号 (trailing commas)
        cleaned = re.sub(r',\s*([\]}])', r'\1', cleaned)

        try:
            parsed = json.loads(cleaned.strip(), strict=False)
        except json.JSONDecodeError as je:
            return {
                "overview": None,
                "explore_chips": [],
                "theme_tags": [],
                "error": f"模型返回格式无法解析: {str(je)}\n原始内容片段: {cleaned[:100]}...",
                "http_status": 200,
            }

        # NOTE: 兼容模型返回不同字段名的情况（如 "summary" 而非 "overview"）
        if not parsed.get("overview"):
            for alt_key in ("summary", "content", "text", "brief", "description"):
                if parsed.get(alt_key):
                    parsed["overview"] = parsed[alt_key]
                    break

        parsed["latency_ms"] = latency_ms
        return parsed

    except httpx.HTTPStatusError as e:
        # NOTE: 针对常见 HTTP 状态码给出清晰的中文提示，方便团队排查
        code = e.response.status_code
        if code == 503:
            msg = f"{model_name} 在 n1n.ai 暂不可用（503）。可能该模型 ID 有误或平台暂未上线，请换其他模型试试。"
        elif code == 404:
            msg = f"{model_name} 模型不存在（404），请确认 n1n.ai 是否支持该模型 ID。"
        elif code == 401:
            msg = "API Key 无效或已过期（401），请检查 N1N_API_KEY 配置。"
        elif code == 429:
            msg = "请求过于频繁（429），请稍后再试。"
        else:
            msg = f"API 请求失败（{code}）：{e.response.text[:200]}"
        return {
            "overview": None,
            "explore_chips": [],
            "theme_tags": [],
            "error": msg,
            "http_status": code,
        }
    except Exception as e:
        return {
            "overview": None,
            "explore_chips": [],
            "theme_tags": [],
            "error": f"生成失败：{str(e)}",
        }


async def explain_tag_with_model(
    book_name: str,
    chapter: int,
    tag: str,
    model_name: str,
    version: str = "cuv"
) -> dict:
    import time
    if version == "kjv":
        prompt = f"Please interpret the keyword 【{tag}】 based on '{book_name} Chapter {chapter}'.\nYou must provide your answer in English and strictly from the following 3 perspectives point by point:\n1. Why this word is chosen as a keyword for this chapter.\n2. What this keyword specifically means in this chapter.\n3. How this keyword echoes or correlates with this chapter in other books of the entire Bible."
        sys_prompt = "You are a Bible scholar skilled at concise, insightful commentary in English."
    elif version in ("keb", "krv", "snr"):
        prompt = f"《{book_name} {chapter}장》을 바탕으로 키워드 【{tag}】에 대해 해설해 주세요.\n반드시 다음 3가지 관점에서 한국어로 나누어 설명해 주세요:\n1. 이 단어를 본 장의 키워드로 선정한 이유.\n2. 본 장에서 이 키워드가 가지는 구체적인 의미.\n3. 성경 전체의 다른 책들에서 이 키워드가 본 장과 어떻게 호응하거나 호환성을 가지는지."
        sys_prompt = "당신은 성경 학자로, 간결하고 깊이 있는 한국어 성경 해설을 잘합니다."
    else:
        prompt = f"请基于《{book_name} 第 {chapter} 章》，解读关键词：【{tag}】。\n请必须且仅从以下 3 个方面分点作答：\n1. 为什么这章要选这个词为关键词。\n2. 在本章中这个关键词具体意味着什么。\n3. 在整本圣经的其他书卷里，这个关键词和本章有什么呼应或关联。"
        sys_prompt = "你是一位圣经学者，善于用简洁有深度的中文进行圣经释义。"
    if not settings.N1N_API_KEY:
        return {"answer": "系统未配置 N1N_API_KEY，无法调用 AI。", "latency_ms": None}
    try:
        start = time.time()
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.N1N_API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.N1N_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.7,
                },
            )
        latency_ms = int((time.time() - start) * 1000)
        resp.raise_for_status()
        data = resp.json()
        return {"answer": data["choices"][0]["message"]["content"].strip(), "latency_ms": latency_ms}
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 503: msg = f"{model_name} 在 n1n.ai 暂不可用（503）。"
        elif code == 404: msg = f"{model_name} 模型不存在（404）。"
        elif code == 401: msg = "API Key 无效或已过期（401）。"
        elif code == 429: msg = "请求过于频繁（429）。"
        else: msg = f"API 请求失败（{code}）：{e.response.text[:200]}"
        return {"error": msg, "answer": "", "latency_ms": None}
    except Exception as e:
        return {"error": f"解释失败：{str(e)}", "answer": "", "latency_ms": None}
