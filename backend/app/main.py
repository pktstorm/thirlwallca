from fastapi import FastAPI
from app.middleware.cors import setup_cors
from app.http.handlers import (
    health,
    persons,
    auth,
    signup,
    admin,
    relationships,
    locations,
    tree,
    media,
    stories,
    comments,
    migrations,
    timeline_events,
    users,
    search,
    person_residences,
    person_alternate_names,
    map_data,
    import_handler,
    memories,
    photo_tags,
    traditions,
    dashboard,
    family_stats,
)

def create_app() -> FastAPI:
    app = FastAPI(
        title="Thirlwall.ca API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redirect_slashes=False,
    )

    setup_cors(app)

    app.include_router(health.router, prefix="/api/v1", tags=["health"])
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(signup.router, prefix="/api/v1/auth", tags=["signup"])
    app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
    app.include_router(persons.router, prefix="/api/v1/persons", tags=["persons"])
    app.include_router(relationships.router, prefix="/api/v1/relationships", tags=["relationships"])
    app.include_router(locations.router, prefix="/api/v1/locations", tags=["locations"])
    app.include_router(tree.router, prefix="/api/v1/tree", tags=["tree"])
    app.include_router(media.router, prefix="/api/v1/media", tags=["media"])
    app.include_router(stories.router, prefix="/api/v1/stories", tags=["stories"])
    app.include_router(comments.router, prefix="/api/v1/comments", tags=["comments"])
    app.include_router(migrations.router, prefix="/api/v1/migrations", tags=["migrations"])
    app.include_router(timeline_events.router, prefix="/api/v1/timeline-events", tags=["timeline-events"])
    app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
    app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
    app.include_router(person_residences.router, prefix="/api/v1/persons", tags=["person-residences"])
    app.include_router(person_alternate_names.router, prefix="/api/v1/persons", tags=["person-alternate-names"])
    app.include_router(map_data.router, prefix="/api/v1/map", tags=["map"])
    app.include_router(import_handler.router, prefix="/api/v1/import", tags=["import"])
    app.include_router(memories.router, prefix="/api/v1/memories", tags=["memories"])
    app.include_router(photo_tags.router, prefix="/api/v1/photo-tags", tags=["photo-tags"])
    app.include_router(traditions.router, prefix="/api/v1/traditions", tags=["traditions"])
    app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
    app.include_router(family_stats.router, prefix="/api/v1/stats", tags=["family-stats"])

    return app

app = create_app()
