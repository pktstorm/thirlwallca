# Thirlwall.ca

A private, invite-only family ancestry website for the Thirlwall family. Explore your family tree, trace migration paths across the globe, read life stories, share memories, and collaborate on genealogy research — all in one immersive, interactive experience.

**Live:** [thirlwall.ca](https://thirlwall.ca)

---

## Features

### Family Tree
- Interactive tree visualization with **couple-centric nodes** (spouses shown as a single card)
- **Semantic zoom** — bird's-eye colored dots at low zoom, compact pills at medium, full detail cards at high zoom
- Branch and full-tree viewing modes with progressive expand-on-demand
- Direct-line highlighting with glowing paths to ancestors and descendants
- Search, time filtering, and generation labels

### Migration Map
- World map showing birth, death, and residence locations for all family members
- **"My Journey"** — view your own life path on the map
- **"My Ancestors"** — multi-generational ancestor trail with generation-colored paths (green → teal → purple → amber)
- **Timeline playback** — press play to watch the family spread across the map over centuries
- Click markers for location details, people, and linked stories

### Life Path Visualization
- Animated full-screen map showing a single person's life journey
- Sequential stops: birth → residences → death with curved path lines
- Play/pause controls with clickable progress bar

### Person Profiles
- **Tabbed layout**: Overview, Story & Timeline, Gallery, Details
- **At-a-glance hero** with relationship-to-you ("Your great-grandmother"), auto-generated life summary, and historical context ("During the reign of Queen Victoria")
- **Family mini-tree** showing parents, spouses (with shared vs. solo children), and children as clickable nodes
- **Photo gallery** with full-screen lightbox (keyboard navigation)
- **Timeline event editor** — inline add/edit/delete of life events
- **Share a Memory** — lightweight contribution available to all users, including viewers
- **Life Path** button to launch the animated map journey

### Stories & Discussion
- Rich life story pages with cover images and timeline visualization
- **Discussion panel** with threaded comments, likes, and replies
- Comment author names and avatars resolved from user accounts

### "How Are We Related?" Tool
- Pick any two people and discover their connection
- Visual step-by-step relationship path with natural language description

### Family Dashboard (`/home`)
- **10-second insight**: stat pills (People, Generations, Countries, Stories, Photos)
- **"On This Day"** — births, deaths, marriages matching today's date across all years
- **"Your Branch"** — immediate family as clickable chips
- **Role-based panels**: Admin (pending signups, audit stats), Editor (contribute CTAs), Viewer (discover CTAs)
- **Recent Activity** feed from audit logs with user attribution
- **Daily fun fact** rotated from auto-generated data

### Collaborative Genealogy
- **"Ask the Family"** question board with answers and resolution tracking
- **Research Notes** — shared workspace with status tracking (Open, Lead, Brick Wall, Resolved)
- **Historical Record Linking** — attach census, immigration, military, church records to people
- **Family Challenges** — gamified quests with progress tracking and leaderboard

### Heritage & Culture
- **Recipes & Traditions** — family recipes, customs, sayings, with category filtering
- **Family Calendar** — month grid view of all birthdays, death anniversaries, wedding anniversaries
- **Photo Comparison Slider** — then-and-now pairs with drag slider
- **Audio Recording** — record voice narrations in the browser via MediaRecorder API
- **Historical Context Overlays** — curated dataset of 80+ milestones + British/Canadian monarchs

### Smart Features
- **Smart Relationship Suggestions** — fuzzy name + birth year matching when adding new people to prevent duplicates
- **OCR Document Transcription** — client-side Tesseract.js extracts text from scanned documents
- **Full-text search** with multi-word prefix matching across names, nicknames, and bios

### Administration
- **Users tab**: approve/reject signup requests, manage roles, deactivate, reset passwords, delete users
- **Signup Codes tab**: create reusable invite codes that bypass approval (configurable role, max uses, expiry)
- **Errors tab**: captures all 500 errors with full stack trace, request body, user agent — mark resolved or delete
- **Audit Log tab**: filterable log of all user actions with expandable JSON details and aggregate stats

### Authentication & Signup
- AWS Cognito-based auth with JWT tokens via AWS Amplify
- **Signup flow**: request access → admin approval → magic link email → set password + link to person
- **Signup codes**: admin-created codes for instant registration without approval
- Show/hide password toggle on all password fields

### Mobile
- **Bottom navigation bar** (Home, Tree, Map, Search, More) on screens < 640px
- Responsive layouts across all pages
- iOS safe area support
- Generation filter dropdown replaces time slider on mobile

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind v4, shadcn/ui |
| Routing | TanStack Router (file-based) |
| Data | TanStack Query v5, Zustand |
| Tree | React Flow (@xyflow/react) with custom layout algorithm |
| Map | MapLibre GL via react-map-gl |
| OCR | Tesseract.js (client-side) |
| Icons | Lucide React |
| Backend | FastAPI, Python 3.12+, Poetry |
| ORM | SQLAlchemy 2.0 async, Alembic |
| Database | PostgreSQL 18 |
| Auth | AWS Cognito, JWT, boto3 |
| Email | AWS SES |
| Storage | AWS S3 + CloudFront CDN |
| Hosting | AWS EC2 (API), S3/CloudFront (frontend) |
| IaC | Terraform (modular) |
| DNS/SSL | Route53, ACM |

---

## Getting Started

### Prerequisites
- Node.js 20+, Yarn v4 (via corepack)
- Python 3.12+, Poetry
- Docker (for local PostgreSQL)
- AWS CLI configured (for deployment)

### Setup
```bash
cd site
make setup          # Install all dependencies
make db-up          # Start PostgreSQL
make db-migrate     # Run migrations
make dev            # Start frontend + backend
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:8000`.

### Environment Variables

**Frontend** (`frontend/.env`):
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_COGNITO_REGION=us-east-1
```

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql+asyncpg://thirlwall:thirlwall_dev@localhost:5432/thirlwall
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_REGION=us-east-1
S3_MEDIA_BUCKET=thirlwall-media
API_CORS_ORIGINS=http://localhost:5173
```

When `COGNITO_USER_POOL_ID` is empty, the app runs in **dev mode** — JWT validation is bypassed and mock tokens are returned.

---

## Deployment

```bash
make deploy         # Deploy frontend + backend
make deploy-fe      # Frontend only (build → S3 sync → CloudFront invalidation)
make deploy-be      # Backend only (rsync → poetry install → migrate → restart)
```

### Infrastructure
Terraform modules in `terraform/`:
- **auth** — Cognito user pool + client
- **cdn** — CloudFront distribution + S3 origin
- **compute** — EC2 instance + IAM role + systemd service
- **email** — SES domain identity + DKIM
- **network** — VPC + subnet + security groups
- **ssl** — ACM certificate
- **storage** — S3 buckets (frontend, media)

---

## Operations

```bash
make logs           # Tail production API logs
make ssh            # SSH into production EC2
make lint           # Run all linters
make typecheck      # TypeScript type check
make test           # Run all tests
```

---

## User Roles

| Role | Permissions |
|------|------------|
| **Admin** | Full access + user management + signup codes + audit logs + error logs |
| **Editor** | Add/edit people, relationships, stories, media, timeline events, traditions |
| **Viewer** | Read-only + edit own profile + share memories + post comments + ask questions |

---

## Database Schema

**30+ tables** organized by domain:

- **Core**: users, persons, relationships, locations, migrations, person_residences, person_alternate_names
- **Content**: media, media_persons, stories, story_persons, comments, comment_likes, timeline_events
- **Social**: memories, family_questions, family_answers, family_traditions, family_tradition_persons
- **Genealogy**: historical_records, person_photo_tags, photo_comparisons, research_notes
- **Gamification**: family_challenges, challenge_progress
- **Auth**: signup_requests, onboard_tokens, signup_codes
- **System**: audit_logs, error_logs

---

## License

Private. This project is not open source.
