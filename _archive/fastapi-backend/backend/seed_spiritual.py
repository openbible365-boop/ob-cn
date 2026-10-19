import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.core.database import AsyncSessionLocal, engine
from backend.model.spiritual import SpiritualStage, SpiritualQuestion

async def seed_spiritual():
    async with AsyncSessionLocal() as db:
        # 1. 清理现有数据（重新初始化）
        await db.execute(select(SpiritualQuestion)) # 级联删除建议，如果没有级联则手动清理
        questions = await db.execute(select(SpiritualQuestion))
        for q in questions.scalars().all():
            await db.delete(q)
        
        stages_res = await db.execute(select(SpiritualStage))
        for s in stages_res.scalars().all():
            await db.delete(s)
        
        await db.flush()

        print("开始初始化属灵阶段数据 (6级体系)...")
        
        stages = [
            {
                "name": "不信者 / 探索者", 
                "description": "对信仰感兴趣，正在寻找人生的意义和真理。",
                "sort_order": 1,
                "general_questions": [
                    "你相信世界上有一位创造主吗？",
                    "你如何看待《圣经》在人类历史中的地位？",
                    "你目前在生活中最渴望得到的指引是什么？"
                ],
                "verse_questions": [
                    "这段经文是在讲上帝吗？",
                    "我对这段话有点不解，能解释一下吗？",
                    "这段话跟我现在的生活有什么关系？"
                ]
            },
            {
                "name": "初信者 / 圣经初学者", 
                "description": "刚刚接受基督，开始建立信仰根基。",
                "sort_order": 2,
                "general_questions": [
                    "你是否已经确信耶稣基督是你个人的救主？",
                    "你是否开始操练每天的祷告和读经？",
                    "你是否已经加入了合适的教会或小组？"
                ],
                "verse_questions": [
                    "这段经文教导了我关于耶稣的什么？",
                    "作为一个新手，我该如何开始应用这段话？",
                    "这段经文里有没有我需要认的罪或学习的榜样？"
                ]
            },
            {
                "name": "稳定阅读者 / 一般信徒", 
                "description": "保持日常读经习惯，对真理有基本的渴慕与认识。",
                "sort_order": 3,
                "general_questions": [
                    "你是否能感受到圣灵在日常抉择中的引导？",
                    "在遇到困惑时，你是否习惯于在经文中寻找答案？",
                    "你是否愿意在小组中分享你读经的心得？"
                ],
                "verse_questions": [
                    "这段经文如何深化我对神属性的认识？",
                    "这节经文与本章的大背景有什么关联？",
                    "我可以如何用这段经文来为他人祷告？"
                ]
            },
            {
                "name": "进阶研读者 / 教会同工", 
                "description": "深入查考经文，参与教会服事，在真理上有追求。",
                "sort_order": 4,
                "general_questions": [
                    "你是否开始尝试使用注释书或其他工具辅助查经？",
                    "你是否有意识地将经文教导应用在教会服事中？",
                    "你是否在有意识地向周围的人分享你的信仰见证？"
                ],
                "verse_questions": [
                    "这段经文在整个救恩历史逻辑中处于什么位置？",
                    "这段话对现阶段的教会服事有什么具体的指导意义？",
                    "这段经文是否对应了其他的平行经文？"
                ]
            },
            {
                "name": "教牧人员 / 资深圣经教师", 
                "description": "生命丰盛，能够牧养他人，并具备教导真理的能力。",
                "sort_order": 5,
                "general_questions": [
                    "你是否清楚上帝对你生命的具体呼召和托付？",
                    "你是否正在协助他人或在教会中承担牧养/教导职责？",
                    "你的生命是否结出了明显的圣灵果子（仁爱、喜乐、和平等）？"
                ],
                "verse_questions": [
                    "在牧养过程中，我该如何向羊群阐释这段经文？",
                    "这段经文对于当代社会伦理挑战提供了哪些神学视角？",
                    "这段经文背后的原文字义在讲章中应如何准确呈现？"
                ]
            },
            {
                "name": "神学研究人员", 
                "description": "系统学习神学知识，致力于深入挖掘真理并建立神学架构。",
                "sort_order": 6,
                "general_questions": [
                    "你目前主要关注的神学课题或经文研究方向是什么？",
                    "你如何在学术研究与个人的属灵生命之间保持平衡？",
                    "你认为现在的神学研究对当代教会有哪些重要的贡献？"
                ],
                "verse_questions": [
                    "这段经文在圣经神学与系统神学的交叉点上如何体现？",
                    "有哪些经典或现代神学著作对这一章节有深度评注？",
                    "这段经文的原文语法结构对教义分析有何决定性影响？"
                ]
            }
        ]

        for s_data in stages:
            gen_q = s_data.pop("general_questions")
            ver_q = s_data.pop("verse_questions")
            stage = SpiritualStage(**s_data)
            db.add(stage)
            await db.flush()
            
            for q_text in gen_q:
                db.add(SpiritualQuestion(stage_id=stage.id, question_text=q_text, category="general"))
            
            for q_text in ver_q:
                db.add(SpiritualQuestion(stage_id=stage.id, question_text=q_text, category="verse_drawer"))
        
        await db.commit()
        print("属灵阶段 6 级体系数据初始化完成！")

if __name__ == "__main__":
    asyncio.run(seed_spiritual())
