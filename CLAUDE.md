# Thirlwall.ca - Family Ancestry Website

## Project Overview
A private, invite-only ancestry website for the Thirlwall family. Features an interactive family tree, migration map, life stories, collaborative genealogy tools, and immersive heritage exploration. Built for users of all ages and technical abilities.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Yarn v4, Tailwind v4, shadcn/ui, TanStack Router + Query, Zustand, MapLibre GL, React Flow, Tesseract.js, Lucide Icons
- **Backend**: FastAPI, Python 3.12+, Poetry, SQLAlchemy 2.0 async, Alembic, Pydantic v2, boto3
- **Database**: PostgreSQL 18 (local via Docker Compose, production on EC2)
- **Infrastructure**: Terraform (modular), AWS (Cognito, S3, CloudFront, EC2, Route53, SES, ACM)
- **Fonts**: Roboto (primary UI), Newsreader (serif for stories)

## Project Structure
```
frontend/          React SPA (Vite, file-based routing)
  src/
    routes/        TanStack Router file-based routes
    components/    Reusable UI components (tree/, map/, person/, layout/, etc.)
    stores/        Zustand state stores (auth, tree, map, ui)
    types/         TypeScript type definitions
    lib/           Utilities, API client, constants, historical context data
backend/           FastAPI app (Poetry)
  app/
    domain/        SQLAlchemy models + enums
    http/handlers/ FastAPI route handlers (one file per resource)
    http/schemas/  Pydantic request/response schemas
    services/      Business logic (audit, email, geocoding, etc.)
    auth/          Cognito JWT validation + RBAC
    middleware/    CORS, error capture
  alembic/         Database migrations
terraform/         Infrastructure as Code (modular)
  modules/         auth, cdn, compute, email, network, ssl, storage
  environments/    production
docker/            Docker Compose for local PostgreSQL
```

## Development Commands
- `make setup` - Install all dependencies
- `make dev` - Start frontend + backend concurrently
- `make dev-fe` / `make dev-be` - Start individually
- `make db-up` / `make db-down` - Docker Compose PostgreSQL
- `make db-migrate` - Run Alembic migrations
- `make db-revision MSG="..."` - Create new migration
- `make lint` / `make typecheck` / `make test` - Quality checks
- `make deploy` - Deploy both frontend and backend
- `make deploy-fe` / `make deploy-be` - Deploy individually
- `make logs` - Tail production API logs
- `make ssh` - SSH into production EC2

## Key Conventions
- Never name a database column "metadata" — reserved in PostgreSQL
- All database changes via Alembic migrations (use raw SQL with IF NOT EXISTS for idempotency)
- Use Makefiles for consistent commands
- Frontend uses file-based routing with TanStack Router
- Backend follows: domain/models → http/handlers/ → services/
- API endpoints prefixed with `/api/v1/`
- Auth via Cognito JWT in Authorization header; DB role is source of truth (not Cognito claim)
- Signup flow: request-access → admin approval OR signup code → onboard (set password)
- Audit logging via `log_audit()` for all mutations
- Error capture middleware stores 500s in error_logs table
- Use `values_callable=lambda e: [m.value for m in e]` on Enum columns for PostgreSQL compatibility

## Color Palette
- Primary: `#30e86e`, Primary-dark: `#1a5c30`, Primary-darker: `#112116`
- Sage scale: 50 `#f4f7f5` → 800 `#3d5244`
- Earth: 800 `#3a3228`, 900 `#241f19`
- Parchment: `#fdfbf7`
- Dark mode: surface `#1a2e20`, card `#1f3527`, border `rgba(48,232,110,0.15)`

## User Roles
- **Admin**: Full access, manage users, approve signups, create signup codes, view audit logs + errors
- **Editor**: Add/remove people, edit properties, add media/stories/memories/traditions
- **Viewer**: Read-only + edit own profile + add comments + share memories

## Pages
| Route | Description | Auth |
|-------|-------------|------|
| `/home` | Dashboard: stats, on-this-day, role-based panels, activity | All |
| `/tree` | Interactive family tree (couple nodes, semantic zoom, branch/full) | All |
| `/map` | Migration map (ancestor trails, timeline playback, generation colors) | All |
| `/search` | Person search with relationship + quick stats | All |
| `/person/:id` | Profile (tabs: overview, story & timeline, gallery, details) | All |
| `/person/:id/story` | Life story + timeline + discussion | All |
| `/person/:id/story-edit` | Story editor | Editor+ |
| `/related` | "How Are We Related?" path finder | All |
| `/stats` | Family statistics (names, lifespans, geography) | All |
| `/calendar` | Anniversary/memorial calendar (month grid) | All |
| `/questions` | "Ask the Family" Q&A board | All |
| `/research` | Collaborative research notes | All |
| `/traditions` | Family recipes & traditions | All |
| `/settings` | Password change | All |
| `/admin` | Users, signup codes, errors, audit logs | Admin |
| `/login` | Login (show/hide password) | Public |
| `/request-access` | Signup request (optional signup code) | Public |
| `/onboard` | Password setup after approval | Public |

## Key Features
- **Couple-centric tree nodes** with semantic zoom (bird's eye, overview, detail)
- **Family-unit layout algorithm** (replaces ELK) grouping couples + children
- **Ancestor trail** on map with generation-colored paths
- **Life path visualization** — animated map journey per person
- **Progressive disclosure** — expand tree on demand
- **Historical context overlays** — monarch + world events on birth dates
- **Audio story recording** via MediaRecorder API
- **OCR document transcription** via Tesseract.js (client-side)
- **Photo comparison slider** (then-and-now)
- **Smart relationship suggestions** when adding new people
- **Signup codes** for instant registration without admin approval
- **Mobile bottom navigation** bar with responsive layout
- **Audit logging** on all mutations
- **Error tracking** — 500s captured in DB, visible in admin console

## Database Tables (30+)
Core: users, persons, relationships, locations, migrations, person_residences, person_alternate_names
Content: media, media_persons, stories, story_persons, comments, comment_likes, timeline_events
Social: memories, family_questions, family_answers, family_traditions, family_tradition_persons
Genealogy: historical_records, person_photo_tags, photo_comparisons, research_notes
Gamification: family_challenges, challenge_progress
Auth: signup_requests, onboard_tokens, signup_codes
System: audit_logs, error_logs
