"""Create media records for the 79 extracted Thirlwall family photos."""
import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession


async def main():
    from app.config import settings
    from app.domain.models import User, Media
    from app.domain.enums import MediaType, MediaStatus

    engine = create_async_engine(settings.database_url)
    async with AsyncSession(engine) as db:
        # Get Sam's user ID
        r = await db.execute(select(User.id).where(User.email == "samjdthirlwall@gmail.com"))
        user_id = r.scalar()
        if not user_id:
            print("User not found")
            return

        created = 0
        for i in range(1, 80):
            s3_key = f"gallery/thirlwall-pics/thirlwall-pic-{i:03d}.jpeg"

            # Check if already exists
            existing = await db.execute(select(Media.id).where(Media.s3_key == s3_key))
            if existing.scalar():
                continue

            media = Media(
                title=f"Thirlwall Family Photo {i}",
                media_type=MediaType.PHOTO,
                s3_key=s3_key,
                s3_bucket="thirlwall-media",
                mime_type="image/jpeg",
                status=MediaStatus.READY,
                uploaded_by=user_id,
            )
            db.add(media)
            created += 1

        await db.commit()
        print(f"Created {created} media records")


if __name__ == "__main__":
    asyncio.run(main())
