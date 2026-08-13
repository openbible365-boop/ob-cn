import os
import sys
import asyncio

# 将项目根目录加入 sys.path，便于导入 backend 包
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete
from backend.core.database import AsyncSessionLocal, engine, Base
from backend.model.encyclopedia import EncyclopediaEntry
from backend.service.pinyin_index import first_letter


async def seed_encyclopedia():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        await db.execute(delete(EncyclopediaEntry))

        # ── 词典（首字母由 title_zh 自动计算）──
        DICTIONARY = [
            {
                "id": "d1", "category": "神学词汇",
                "title_zh": "恩典", "title_en": "Grace", "title_ko": "은혜",
                "content_zh": "恩典指神白白赐给人、不基于人功劳的恩惠。在新约中，恩典尤指神借着耶稣基督所成就的救赎，是人得救的根本（以弗所书 2:8）。",
                "content_en": "Grace is the unmerited favor of God toward humanity, freely given apart from works. In the New Testament it especially refers to salvation accomplished through Jesus Christ (Ephesians 2:8).",
                "content_ko": "은혜는 인간의 공로와 상관없이 하나님이 값없이 베푸시는 호의를 가리킵니다. 신약에서는 특히 예수 그리스도를 통해 이루어진 구원을 의미합니다 (에베소서 2:8).",
            },
            {
                "id": "d2", "category": "神学词汇",
                "title_zh": "救赎", "title_en": "Redemption", "title_ko": "구속",
                "content_zh": "救赎原指付赎价将人赎回。圣经用此描述神借基督的宝血，把人从罪与死的捆绑中释放出来，使其归属于神。",
                "content_en": "Redemption originally means buying back by paying a ransom. Scripture uses it to describe how God, through the blood of Christ, frees people from the bondage of sin and death.",
                "content_ko": "구속은 본래 대가를 지불하여 되사는 것을 의미합니다. 성경은 하나님이 그리스도의 피로 사람을 죄와 죽음의 속박에서 해방시키심을 묘사하는 데 이 말을 사용합니다.",
            },
            {
                "id": "d3", "category": "神学词汇",
                "title_zh": "圣约", "title_en": "Covenant", "title_ko": "언약",
                "content_zh": "圣约是神与人之间庄严的盟约关系。圣经记载了多个圣约，如与挪亚、亚伯拉罕、摩西所立的约，以及借基督所立的新约。",
                "content_en": "A covenant is a solemn binding relationship between God and humanity. Scripture records several covenants, such as those with Noah, Abraham, Moses, and the new covenant in Christ.",
                "content_ko": "언약은 하나님과 인간 사이의 엄숙한 관계입니다. 성경은 노아, 아브라함, 모세와의 언약, 그리고 그리스도 안에서의 새 언약 등 여러 언약을 기록합니다.",
            },
            {
                "id": "d4", "category": "圣经人物",
                "title_zh": "亚伯拉罕", "title_en": "Abraham", "title_ko": "아브라함",
                "content_zh": "亚伯拉罕被称为「信心之父」。神呼召他离开本地本族，应许使他成为大国，万国都要因他得福（创世记 12 章）。",
                "content_en": "Abraham is called the 'father of faith.' God called him to leave his homeland and promised to make him into a great nation through whom all peoples would be blessed (Genesis 12).",
                "content_ko": "아브라함은 '믿음의 조상'이라 불립니다. 하나님은 그를 고향에서 불러내시고 큰 민족을 이루어 모든 민족이 복을 받게 하리라 약속하셨습니다 (창세기 12장).",
            },
        ]

        # ── 文章 ──
        ARTICLES = [
            {
                "id": "art1", "category": "信仰生活", "author": "编辑部",
                "cover_style": "linear-gradient(135deg, #667eea, #764ba2)",
                "title_zh": "如何开始每日读经", "title_en": "How to Begin Daily Bible Reading", "title_ko": "매일 성경 읽기를 시작하는 법",
                "summary_zh": "读经不在乎多，而在乎恒。本文分享几个简单可行的方法，帮助你建立每天与神相会的习惯。",
                "summary_en": "Consistency matters more than quantity. A few practical tips to build a daily habit of meeting God in His Word.",
                "summary_ko": "양보다 꾸준함이 중요합니다. 매일 말씀으로 하나님을 만나는 습관을 세우는 실용적인 방법들.",
                "content_zh": "读经是基督徒灵命成长的根基。\n\n第一，固定时间与地点。每天选一个安静的时段，哪怕只有十分钟。\n\n第二，从一卷书读起，而非随意翻阅。建议初学者从约翰福音开始。\n\n第三，读后默想一节。把一节经文记在心里，反复思想，让神的话在一天中陪伴你。\n\n愿你在神的话语中得着滋养与力量。",
                "content_en": "Bible reading is the foundation of a believer's spiritual growth.\n\nFirst, fix a time and place. Choose a quiet moment each day, even just ten minutes.\n\nSecond, read through one book rather than flipping randomly. Beginners are encouraged to start with the Gospel of John.\n\nThird, meditate on one verse afterward. Keep a verse in your heart and let God's word accompany you through the day.\n\nMay you be nourished and strengthened in God's word.",
                "content_ko": "성경 읽기는 신자의 영적 성장의 기초입니다.\n\n첫째, 시간과 장소를 정하세요. 매일 조용한 시간을 택하되 단 십 분이라도 좋습니다.\n\n둘째, 무작위로 펼치기보다 한 권을 통독하세요. 초심자는 요한복음부터 시작하기를 권합니다.\n\n셋째, 읽은 후 한 구절을 묵상하세요. 한 구절을 마음에 두고 하루 종일 하나님의 말씀이 함께하게 하십시오.\n\n하나님의 말씀 안에서 양육과 힘을 얻기를 바랍니다.",
            },
        ]

        # ── 灵修 ──
        DEVOTIONALS = [
            {
                "id": "dev1", "category": "晨更灵修", "author": "牧者灵修",
                "cover_style": "linear-gradient(135deg, #fa709a, #fee140)",
                "title_zh": "在安静中遇见神", "title_en": "Meeting God in Stillness", "title_ko": "고요함 속에서 하나님을 만나다",
                "summary_zh": "「你们要休息，要知道我是神。」——诗篇 46:10",
                "summary_en": "\"Be still, and know that I am God.\" — Psalm 46:10",
                "summary_ko": "\"너희는 가만히 있어 내가 하나님 됨을 알지어다.\" — 시편 46:10",
                "content_zh": "在喧嚣的世界里，我们太容易被各样的声音淹没。\n\n诗篇的作者邀请我们停下来，安静下来，重新认识那位掌权的神。安静不是无所事事，而是把心转向神，在祂面前卸下重担。\n\n今天，给自己留几分钟，什么都不做，只是安静地坐在神面前。你会发现，祂一直都在。",
                "content_en": "In a noisy world, we are easily overwhelmed by countless voices.\n\nThe psalmist invites us to stop, to be still, and to know afresh the God who reigns. Stillness is not idleness; it is turning our hearts to God and laying our burdens before Him.\n\nToday, give yourself a few minutes to do nothing but sit quietly before God. You will find that He has been there all along.",
                "content_ko": "시끄러운 세상에서 우리는 수많은 소리에 쉽게 압도됩니다.\n\n시편 기자는 우리를 멈추고 고요히 하여 다스리시는 하나님을 새롭게 알라고 초대합니다. 고요함은 아무것도 하지 않음이 아니라, 마음을 하나님께 돌이키고 그 앞에 짐을 내려놓는 것입니다.\n\n오늘, 몇 분간 아무것도 하지 말고 하나님 앞에 조용히 앉아 보십시오. 그분이 줄곧 거기 계셨음을 알게 될 것입니다.",
            },
        ]

        order = 0
        for d in DICTIONARY:
            order += 1
            db.add(EncyclopediaEntry(
                entry_type="dictionary",
                index_letter=first_letter(d["title_zh"]),
                sort_order=order,
                is_active=True,
                **d,
            ))
        order = 0
        for a in ARTICLES:
            order += 1
            db.add(EncyclopediaEntry(entry_type="article", sort_order=order, is_active=True, **a))
        order = 0
        for v in DEVOTIONALS:
            order += 1
            db.add(EncyclopediaEntry(entry_type="devotional", sort_order=order, is_active=True, **v))

        await db.commit()
        print(f"Seeded encyclopedia: {len(DICTIONARY)} dictionary, {len(ARTICLES)} article, {len(DEVOTIONALS)} devotional.")


if __name__ == "__main__":
    asyncio.run(seed_encyclopedia())
