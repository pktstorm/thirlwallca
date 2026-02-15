# Thirlwall.ca - Family Ancestry Website

## Project Overview
A private, invite-only ancestry charting website for the Thirlwall family. Focuses on immersive, interactive family tree exploration, stories, media, and migration history.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Yarn v4, Tailwind v4, shadcn/ui, TanStack Router + Query, Zustand, Lucide Icons
- **Backend**: FastAPI, Python 3.12+, Poetry, SQLAlchemy 2.0 async, Alembic, Pydantic v2
- **Database**: PostgreSQL 18 (local via Docker Compose, production on EC2)
- **Infrastructure**: Terraform (modular), AWS (Cognito, S3, CloudFront, EC2, Route53, SES, ACM)

## Project Structure
- `frontend/` - React app (Vite)
- `backend/` - FastAPI app (Poetry)
- `terraform/` - Infrastructure as Code (modular)
- `docker/` - Docker Compose for local development
- `design/` - Design mockups (in parent directory ~/code/thirlwallca/design/)

## Development Commands
- `make setup` - Install all dependencies
- `make dev` - Start frontend + backend concurrently
- `make dev-fe` / `make dev-be` - Start individually
- `make db-up` / `make db-down` - Docker Compose PostgreSQL 18
- `make db-migrate` - Run Alembic migrations
- `make db-revision MSG="..."` - Create new migration
- `make lint` / `make test` - Quality checks

## Key Conventions
- Never name a database column "metadata" - it's reserved in PostgreSQL
- All database changes via Alembic migrations
- Use Makefiles for consistent commands
- Frontend uses file-based routing with TanStack Router
- Backend follows: domain/ (models) -> http/handlers/ (routes) -> services/ (business logic)
- API endpoints prefixed with `/api/v1/`
- Auth via Cognito JWT in Authorization header
- Three user roles: admin, editor, viewer (stored as custom:role in Cognito)
- Design files reference colors: primary #30e86e, primary-dark #1a5c30, bg-light #f6f8f6, parchment #fdfbf7
- Fonts: Inter (primary UI), Newsreader (serif for stories/memoirs)

## User Roles
- **Admin**: Full access, manage users
- **Editor**: Add/remove people, edit properties, add media/stories
- **Viewer**: Read-only + edit own person profile + add comments
