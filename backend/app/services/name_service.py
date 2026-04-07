"""Helper for display name resolution using preferred_name."""


def display_name(person) -> str:
    """Return the display name for a person, using preferred_name if set."""
    first = person.preferred_name or person.first_name
    return f"{first} {person.last_name}"
