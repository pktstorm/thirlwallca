"""Create family stories about Connop Thirlwall from Wikipedia content."""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

STORIES = [
    {
        "title": "Connop Thirlwall: The Prodigy Bishop",
        "subtitle": "A Thirlwall who became one of England's greatest scholar-bishops",
        "slug": "connop-thirlwall-bishop",
        "content": """Connop Thirlwall (11 January 1797 \u2013 27 July 1875) was an English churchman who served as Bishop of St David's in Wales from 1840 to 1874. A noted scholar of history and literature, he is known for pioneering the concept of dramatic irony in the context of studying the ancient Greek tragedian Sophocles.

Thirlwall was born at Stepney, London, to Thomas and Susannah Thirlwall. His father was an Anglican priest who claimed descent from a Northumbrian family \u2014 the same Thirlwall family of Thirlwall Castle. The young Connop was a remarkable prodigy: he learned Latin at three years old, Greek at four, and was writing sermons by the age of seven.

He attended Charterhouse School, where the historian George Grote was among his schoolfellows \u2014 a connection that would prove significant later in both their careers. He went up to Trinity College, Cambridge, in October 1814, where he gained the Craven university scholarship and the chancellor's classical medal.

In 1840, Thirlwall was raised to the see of St David's, entirely through the act of Prime Minister Lord Melbourne, who had been impressed by Thirlwall's scholarly writings. "I don't intend to make a heterodox bishop if I know it," Melbourne said. Thirlwall proved a model bishop, even learning Welsh so as to preach and conduct services in that language \u2014 the first Bishop of St David's to be enthroned in person for many years.

He died on 27 July 1875 at the age of 78, and is buried in Westminster Abbey \u2014 a fitting resting place for a man who bridged the worlds of classical scholarship, religious leadership, and progressive thought.""",
        "category": "history",
        "external_url": "https://en.wikipedia.org/wiki/Connop_Thirlwall",
    },
    {
        "title": "Connop Thirlwall's History of Greece",
        "subtitle": "The scholarly masterwork that rivalled Grote's famous history",
        "slug": "connop-thirlwall-history-of-greece",
        "content": """Among Connop Thirlwall's greatest achievements was his monumental History of Greece, written between 1835 and 1847. Originally commissioned for Dionysius Lardner's Cabinet Cyclopaedia and intended to be condensed into two or three small volumes, the work grew far beyond its original scope.

Compared with George Grote's more famous history of the same subject, Thirlwall's work took a notably different approach. Where Grote wrote with enthusiasm for democratic ideals, Thirlwall maintained scholarly impartiality, giving fair treatment to aristocratic and absolute governments as well. His friend John Sterling pronounced him "a writer as great as Thucydides and Tacitus, and with far more knowledge than they."

The History's popularity was not as immediate as Grote's, but its substantial merits were eventually recognised by the scholarly world. The first volume was published in 1835, the eighth and final volume in 1847 \u2014 a twelve-year labour of scholarship that Thirlwall produced while simultaneously fulfilling his duties as a parish rector in Yorkshire.

Perhaps most remarkably, Thirlwall also pioneered the concept of "dramatic irony" through his earlier paper "On the Irony of Sophocles," published in the Philological Museum in 1831. This contribution to literary theory alone would have secured his intellectual legacy, even without the History of Greece.""",
        "category": "heritage",
        "external_url": "https://en.wikipedia.org/wiki/Connop_Thirlwall",
    },
    {
        "title": "Connop Thirlwall: Champion of Reform",
        "subtitle": "The bishop who stood alone for Jewish emancipation and religious liberty",
        "slug": "connop-thirlwall-reform",
        "content": """Throughout his long career as Bishop of St David's, Connop Thirlwall consistently demonstrated a commitment to progressive causes that set him apart from his contemporaries in the Church of England.

His reforming instincts showed early. In 1834, while still at Cambridge, Thirlwall joined the controversy over the admission of Dissenters to the university. When Thomas Turton, the regius professor of divinity, wrote a pamphlet objecting to their admission, Thirlwall replied by pointing out that no provision for theological instruction was made by the colleges except compulsory attendance at chapel. This attack on tradition cost him his position as assistant tutor \u2014 but marked him out for promotion by the Liberal government.

As bishop, he was the only prelate to vote for the removal of Jewish disabilities \u2014 a lonely stand for religious equality among his fellow bishops. He supported the disestablishment of the Irish Church, understanding that different nations required different religious arrangements.

His eleven famous episcopal charges \u2014 formal addresses delivered to his clergy over the course of his episcopate \u2014 became monuments of progressive ecclesiastical thought. In them, he reviewed the great theological and social questions of the day with the careful scholarship and moral courage that defined his character.

Thirlwall's willingness to stand alone on matters of conscience, whether it cost him his Cambridge tutorship or the approval of his fellow bishops, reflects a principled independence that runs through the Thirlwall family history.""",
        "category": "history",
        "external_url": "https://en.wikipedia.org/wiki/Connop_Thirlwall",
    },
]


async def main():
    from app.config import settings
    from app.domain.models import User, FamilyStory

    engine = create_async_engine(settings.database_url)
    async with AsyncSession(engine) as db:
        r = await db.execute(select(User.id).where(User.email == "samjdthirlwall@gmail.com"))
        author_id = r.scalar()
        if not author_id:
            print("Author not found")
            return

        for s in STORIES:
            existing = await db.execute(select(FamilyStory.id).where(FamilyStory.slug == s["slug"]))
            if existing.scalar():
                print(f"Skipping (exists): {s['title']}")
                continue

            story = FamilyStory(
                title=s["title"], subtitle=s["subtitle"], slug=s["slug"],
                content=s["content"], category=s["category"],
                external_url=s["external_url"], published=True, author_id=author_id,
            )
            db.add(story)
            print(f"Created: {s['title']}")

        await db.commit()
        print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
