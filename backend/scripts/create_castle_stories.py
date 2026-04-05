"""Create family stories about Thirlwall Castle from Wikipedia content."""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

STORIES = [
    {
        "title": "Thirlwall Castle",
        "subtitle": "The ancestral home of the Thirlwall family in Northumberland, England",
        "slug": "thirlwall-castle",
        "content": """Thirlwall Castle is a 12th-century castle in Northumberland, England, on the bank of the River Tipalt close to the village of Greenhead and approximately 20 miles (32 km) west of Hexham. It was built in the 12th century, and later strengthened using stones from nearby Hadrian's Wall, but began to fall into disrepair in the 17th century. The site is protected by Grade I listed building and Scheduled Ancient Monument status.

The castle stands as a testament to the Thirlwall family's long history in the region, dating back to the medieval period when the family held significant influence in the border lands between England and Scotland.

The castle was fortified in about 1330 by John Thirlwall, and in a survey of 1542 it was reported as in the ownership of Robert Thirlwall and in a "measurable good" state of repair.

In 1999, the Northumberland National Park Authority took over the management of the castle, protecting it from further dereliction. It is open to the public without charge.""",
        "cover_image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Thirlwall_Castle_-_geograph.org.uk_-_1068250.jpg/1280px-Thirlwall_Castle_-_geograph.org.uk_-_1068250.jpg",
        "category": "place",
        "external_url": "https://en.wikipedia.org/wiki/Thirlwall_Castle",
    },
    {
        "title": 'The Meaning of "Thirlwall"',
        "subtitle": "How the family name connects to Hadrian's Wall and ancient language",
        "slug": "meaning-of-thirlwall",
        "content": """The name "Thirlwall" carries deep historical significance, combining Middle English "Thirl" with "wall" \u2014 a direct reference to the Roman-built Hadrian's Wall from which Thirlwall Castle was materially constructed.

"Thirl" as a verb means "perforated" or as a noun "bored-wall", derived from the Old English \u00feyrel, meaning "a hole made through anything, an aperture, orifice" and weall, meaning "wall".

As described in an Atlantic Monthly article, a thirl refers to "a small passage built into a wall to allow sheep but not cattle to pass through." This practical feature of agricultural walls became the basis for the family name.

The word has fascinating connections to ancient Greek as well. The Greek word Thura (\u03b8\u03cd\u03c1\u03b1) means "a portal or entrance \u2014 door, gate." The Middle English noun "thirl" likewise references a portal or through passage.

So "Thirlwall" literally means "the wall with a door through it" \u2014 the gap or passage through Hadrian's Wall near where the castle stands. The family took their name from this landmark, forever linking the Thirlwall name to the ancient Roman frontier.""",
        "cover_image_url": None,
        "category": "heritage",
        "external_url": "https://en.wikipedia.org/wiki/Thirlwall_Castle",
    },
    {
        "title": "Sir Percival Thirlwall at the Battle of Bosworth",
        "subtitle": "The Thirlwall knight who held Richard III's standard until the very end",
        "slug": "sir-percival-thirlwall-bosworth",
        "content": """On 22 August 1485, one of the most dramatic and consequential battles in English history took place at Bosworth Field. Among the combatants was Sir Percival Thirlwall of Thirlwall Castle, fighting in the Yorkist cause for King Richard III.

Sir Percival served as Richard III's standard-bearer \u2014 a position of immense honor and danger. The standard-bearer carried the king's banner into battle, making them a primary target for enemy forces. To capture or fell the king's standard was to strike at the heart of the army's morale.

In the final desperate charge at Bosworth, Sir Percival demonstrated extraordinary courage and loyalty. Even after his legs were cut from under him, he continued to hold the royal standard aloft. He refused to let it fall, keeping Richard's banner flying even as the battle turned against the Yorkist cause.

Sir Percival was killed in the fighting. The battle ended with Richard III's death \u2014 the last English king to die in combat \u2014 and Henry Tudor's victory, which established the Tudor dynasty.

Sir Percival's act of defiance in holding the standard after losing his legs has become one of the most celebrated acts of loyalty in the Wars of the Roses, and a defining moment in Thirlwall family history.""",
        "cover_image_url": None,
        "category": "history",
        "external_url": "https://en.wikipedia.org/wiki/Thirlwall_Castle",
    },
    {
        "title": "The End of the Thirlwall Line at the Castle",
        "subtitle": "How Eleanor Thirlwall's marriage ended the family's centuries-long residence",
        "slug": "eleanor-thirlwall-end-of-line",
        "content": """For centuries, the Thirlwall family held their castle on the bank of the River Tipalt in Northumberland. But all family lines eventually face moments of change, and for the Thirlwalls of Thirlwall Castle, that moment came with Eleanor Thirlwall.

Eleanor was the last of the Thirlwall family line to reside at the castle. In 1738, she married Matthew Swinburne of Capheaton Hall, and with this marriage the castle and estate passed out of Thirlwall hands for the first time in its history.

The Swinburne family did not maintain the castle as a residence. Just ten years later, in 1748, they sold the estate to the Earl of Carlisle for \u00a34,000.

Without a family to maintain it, the castle fell into decay. Serious collapses of masonry occurred in 1832 and again in 1982. The once-proud fortress of the Thirlwall family gradually returned to the landscape from which its stones had originally come \u2014 many of them recycled from Hadrian's Wall itself.

It was not until 1999 that the Northumberland National Park Authority took over management of the ruins, finally protecting them from further deterioration. Today the castle is open to the public without charge, a silent monument to the family whose name it bears.""",
        "cover_image_url": None,
        "category": "history",
        "external_url": "https://en.wikipedia.org/wiki/Thirlwall_Castle",
    },
]


async def main():
    from app.config import settings
    from app.domain.models import User, FamilyStory

    engine = create_async_engine(settings.database_url)
    async with AsyncSession(engine) as db:
        # Get author
        r = await db.execute(select(User.id).where(User.email == "samjdthirlwall@gmail.com"))
        author_id = r.scalar()
        if not author_id:
            print("Author not found")
            return

        for s in STORIES:
            # Check if slug already exists
            existing = await db.execute(select(FamilyStory.id).where(FamilyStory.slug == s["slug"]))
            if existing.scalar():
                print(f"Skipping (exists): {s['title']}")
                continue

            story = FamilyStory(
                title=s["title"],
                subtitle=s["subtitle"],
                slug=s["slug"],
                content=s["content"],
                cover_image_url=s["cover_image_url"],
                category=s["category"],
                external_url=s["external_url"],
                published=True,
                author_id=author_id,
            )
            db.add(story)
            print(f"Created: {s['title']}")

        await db.commit()
        print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
