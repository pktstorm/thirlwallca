from pydantic import BaseModel


class ImportSummaryResponse(BaseModel):
    persons_created: int
    persons_updated: int
    persons_skipped: int
    relationships_created: int
    relationships_skipped: int
    locations_created: int
    locations_reused: int
    residences_created: int
    alternate_names_created: int
    errors: list[str]
