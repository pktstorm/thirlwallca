"""Pure GEDCOM 5.5.1 parser.

Parses a GEDCOM file into plain Python dataclasses with zero database
dependencies. Handles individuals (INDI), families (FAM), names, dates,
places with coordinates, burial text, alternate names, and residences.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class GedcomDate:
    value: date | None
    is_approx: bool
    raw: str


@dataclass
class GedcomPlace:
    city: str | None
    region: str | None
    country: str | None
    raw: str
    latitude: float | None = None
    longitude: float | None = None


@dataclass
class GedcomPerson:
    xref_id: str
    first_name: str
    middle_name: str | None
    last_name: str
    gender: str  # "male" | "female" | "unknown"
    birth_date: GedcomDate | None = None
    birth_place: GedcomPlace | None = None
    death_date: GedcomDate | None = None
    death_place: GedcomPlace | None = None
    burial_text: str | None = None
    is_living: bool = True
    aka_names: list[str] = field(default_factory=list)
    residences: list[tuple[GedcomPlace | None, GedcomDate | None]] = field(default_factory=list)
    family_spouse_ids: list[str] = field(default_factory=list)
    family_child_ids: list[str] = field(default_factory=list)


@dataclass
class GedcomFamily:
    xref_id: str
    husband_id: str | None = None
    wife_id: str | None = None
    child_ids: list[str] = field(default_factory=list)
    marriage_date: GedcomDate | None = None
    marriage_place: GedcomPlace | None = None
    divorce_date: GedcomDate | None = None


@dataclass
class GedcomData:
    persons: dict[str, GedcomPerson] = field(default_factory=dict)
    families: dict[str, GedcomFamily] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Month mapping
# ---------------------------------------------------------------------------

_MONTHS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}


# ---------------------------------------------------------------------------
# Line parsing
# ---------------------------------------------------------------------------

# Matches: level [optional @XREF@] TAG [optional value]
_LINE_RE = re.compile(r"^(\d+)\s+(?:(@\S+@)\s+)?(\S+)(?:\s(.*))?$")


def _parse_line(line: str) -> tuple[int, str | None, str, str]:
    """Parse a single GEDCOM line into (level, xref_or_none, tag, value)."""
    m = _LINE_RE.match(line.rstrip())
    if not m:
        return (0, None, "", "")
    level = int(m.group(1))
    xref = m.group(2)
    tag = m.group(3)
    value = m.group(4) or ""
    return (level, xref, tag, value)


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

def _parse_date(s: str) -> GedcomDate | None:
    """Parse a GEDCOM date string into a GedcomDate."""
    s = s.strip()
    if not s:
        return None

    # Strip modifiers like ABT, BEF, AFT, EST, CAL
    cleaned = re.sub(r"^(ABT|BEF|AFT|EST|CAL|FROM|TO|BET)\s+", "", s, flags=re.IGNORECASE)
    # Also strip "AND ..." for BET x AND y ranges — just take the first date
    cleaned = re.sub(r"\s+AND\s+.*$", "", cleaned, flags=re.IGNORECASE)

    parts = cleaned.split()

    try:
        if len(parts) == 3:
            # "23 JUL 1946"
            day = int(parts[0])
            month = _MONTHS.get(parts[1].upper(), 1)
            year = int(parts[2])
            return GedcomDate(value=date(year, month, day), is_approx=False, raw=s)
        elif len(parts) == 2:
            # "JUL 1946" (month + year)
            month = _MONTHS.get(parts[0].upper())
            if month:
                year = int(parts[1])
                return GedcomDate(value=date(year, month, 1), is_approx=True, raw=s)
            # Could be "23 1946" — unlikely but handle
            day = int(parts[0])
            year = int(parts[1])
            return GedcomDate(value=date(year, 1, day), is_approx=True, raw=s)
        elif len(parts) == 1:
            # "1946" (year only)
            year = int(parts[0])
            return GedcomDate(value=date(year, 1, 1), is_approx=True, raw=s)
    except (ValueError, KeyError):
        pass

    return GedcomDate(value=None, is_approx=True, raw=s)


# ---------------------------------------------------------------------------
# Place parsing
# ---------------------------------------------------------------------------

def _parse_latitude(s: str) -> float | None:
    """Parse 'N42.824577' → 42.824577, 'S42.783333' → -42.783333."""
    s = s.strip()
    if not s:
        return None
    sign = -1 if s[0] == "S" else 1
    try:
        return sign * float(s[1:])
    except ValueError:
        return None


def _parse_longitude(s: str) -> float | None:
    """Parse 'W82.495667' → -82.495667, 'E147.066635' → 147.066635."""
    s = s.strip()
    if not s:
        return None
    sign = -1 if s[0] == "W" else 1
    try:
        return sign * float(s[1:])
    except ValueError:
        return None


def _parse_place(place_str: str, lat: float | None = None, lng: float | None = None) -> GedcomPlace:
    """Parse comma-separated place hierarchy into city/region/country."""
    parts = [p.strip() for p in place_str.split(",") if p.strip()]

    if len(parts) >= 3:
        city = parts[0]
        region = parts[-2]
        country = parts[-1]
    elif len(parts) == 2:
        city = parts[0]
        region = None
        country = parts[1]
    elif len(parts) == 1:
        city = parts[0]
        region = None
        country = None
    else:
        city = None
        region = None
        country = None

    return GedcomPlace(
        city=city,
        region=region,
        country=country,
        raw=place_str.strip(),
        latitude=lat,
        longitude=lng,
    )


# ---------------------------------------------------------------------------
# Name parsing
# ---------------------------------------------------------------------------

def _parse_name(name_value: str) -> tuple[str, str | None, str]:
    """Parse GEDCOM name 'FirstMiddle /Surname/' → (first, middle, last)."""
    # Extract surname from between slashes
    surname_match = re.search(r"/([^/]*)/", name_value)
    if surname_match:
        last_name = surname_match.group(1).strip() or ""
        given = name_value[:surname_match.start()].strip()
    else:
        last_name = ""
        given = name_value.strip()

    # Split given names into first + middle
    given_parts = given.split(None, 1)
    if len(given_parts) >= 2:
        first_name = given_parts[0]
        middle_name = given_parts[1]
    elif len(given_parts) == 1:
        first_name = given_parts[0]
        middle_name = None
    else:
        first_name = ""
        middle_name = None

    return (first_name, middle_name, last_name)


# ---------------------------------------------------------------------------
# Record grouping
# ---------------------------------------------------------------------------

def _group_records(lines: list[str]) -> list[list[str]]:
    """Group GEDCOM lines into top-level records (delimited by level-0 lines)."""
    records: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped[0] == "0" and current:
            records.append(current)
            current = []
        current.append(stripped)
    if current:
        records.append(current)
    return records


# ---------------------------------------------------------------------------
# Event sub-record extraction
# ---------------------------------------------------------------------------

def _extract_subrecords(record_lines: list[str], start_idx: int, parent_level: int) -> list[tuple[int, str | None, str, str]]:
    """Collect parsed lines that are children of the line at start_idx."""
    subs = []
    for i in range(start_idx + 1, len(record_lines)):
        level, xref, tag, value = _parse_line(record_lines[i])
        if level <= parent_level:
            break
        subs.append((level, xref, tag, value))
    return subs


def _find_in_subs(subs: list[tuple[int, str | None, str, str]], tag: str, target_level: int | None = None) -> str | None:
    """Find the first occurrence of a tag in subrecords and return its value."""
    for level, _, t, value in subs:
        if t == tag and (target_level is None or level == target_level):
            return value
    return None


def _extract_place_with_coords(subs: list[tuple[int, str | None, str, str]]) -> GedcomPlace | None:
    """Extract PLAC, MAP/LATI/LONG from event subrecords."""
    place_str = _find_in_subs(subs, "PLAC")
    if not place_str:
        return None

    lat_str = _find_in_subs(subs, "LATI")
    lng_str = _find_in_subs(subs, "LONG")
    lat = _parse_latitude(lat_str) if lat_str else None
    lng = _parse_longitude(lng_str) if lng_str else None

    return _parse_place(place_str, lat, lng)


# ---------------------------------------------------------------------------
# Individual parsing
# ---------------------------------------------------------------------------

def _parse_individual(record_lines: list[str]) -> GedcomPerson:
    """Parse an INDI record into a GedcomPerson."""
    # First line: "0 @I1@ INDI"
    _, xref, _, _ = _parse_line(record_lines[0])
    xref_id = xref or ""

    first_name = ""
    middle_name: str | None = None
    last_name = ""
    gender = "unknown"
    birth_date: GedcomDate | None = None
    birth_place: GedcomPlace | None = None
    death_date: GedcomDate | None = None
    death_place: GedcomPlace | None = None
    burial_text: str | None = None
    has_death = False
    aka_names: list[str] = []
    residences: list[tuple[GedcomPlace | None, GedcomDate | None]] = []
    fams: list[str] = []
    famc: list[str] = []

    primary_name_set = False

    i = 1
    while i < len(record_lines):
        level, line_xref, tag, value = _parse_line(record_lines[i])

        if level != 1:
            i += 1
            continue

        if tag == "NAME":
            subs = _extract_subrecords(record_lines, i, 1)
            # Check if this is an aka name
            name_type = _find_in_subs(subs, "TYPE")
            if name_type and name_type.lower() == "aka":
                # This is a nickname — just the value itself
                aka_name = value.strip().rstrip("/").lstrip("/").strip()
                if aka_name:
                    aka_names.append(aka_name)
            elif not primary_name_set:
                first_name, middle_name, last_name = _parse_name(value)
                primary_name_set = True

        elif tag == "SEX":
            sex = value.strip().upper()
            if sex == "M":
                gender = "male"
            elif sex == "F":
                gender = "female"
            else:
                gender = "unknown"

        elif tag == "BIRT":
            subs = _extract_subrecords(record_lines, i, 1)
            date_str = _find_in_subs(subs, "DATE")
            if date_str:
                birth_date = _parse_date(date_str)
            birth_place = _extract_place_with_coords(subs)

        elif tag == "DEAT":
            has_death = True
            # Check for burial text on the DEAT line itself
            if value.strip():
                burial_parts = [value.strip()]
                # Collect CONC lines that continue the burial text
                subs = _extract_subrecords(record_lines, i, 1)
                for sub_level, _, sub_tag, sub_value in subs:
                    if sub_level == 2 and sub_tag == "CONC":
                        burial_parts.append(sub_value)
                    elif sub_level == 2 and sub_tag == "CONT":
                        burial_parts.append("\n" + sub_value)
                burial_text = "".join(burial_parts).strip()

            subs = _extract_subrecords(record_lines, i, 1)
            date_str = _find_in_subs(subs, "DATE")
            if date_str:
                death_date = _parse_date(date_str)
            death_place = _extract_place_with_coords(subs)

        elif tag == "ADDR":
            subs = _extract_subrecords(record_lines, i, 1)
            place = _extract_place_with_coords(subs)
            addr_date_str = _find_in_subs(subs, "DATE")
            addr_date = _parse_date(addr_date_str) if addr_date_str else None
            residences.append((place, addr_date))

        elif tag == "FAMS":
            if value.strip():
                fams.append(value.strip())

        elif tag == "FAMC":
            if value.strip():
                famc.append(value.strip())

        i += 1

    # is_living heuristic: no death event AND (no birth year OR birth year > 1940)
    birth_year = birth_date.value.year if birth_date and birth_date.value else None
    is_living = not has_death and (birth_year is None or birth_year > 1940)

    return GedcomPerson(
        xref_id=xref_id,
        first_name=first_name,
        middle_name=middle_name,
        last_name=last_name,
        gender=gender,
        birth_date=birth_date,
        birth_place=birth_place,
        death_date=death_date,
        death_place=death_place,
        burial_text=burial_text,
        is_living=is_living,
        aka_names=aka_names,
        residences=residences,
        family_spouse_ids=fams,
        family_child_ids=famc,
    )


# ---------------------------------------------------------------------------
# Family parsing
# ---------------------------------------------------------------------------

def _parse_family(record_lines: list[str]) -> GedcomFamily:
    """Parse a FAM record into a GedcomFamily."""
    _, xref, _, _ = _parse_line(record_lines[0])
    xref_id = xref or ""

    husband_id: str | None = None
    wife_id: str | None = None
    child_ids: list[str] = []
    marriage_date: GedcomDate | None = None
    marriage_place: GedcomPlace | None = None
    divorce_date: GedcomDate | None = None

    i = 1
    while i < len(record_lines):
        level, _, tag, value = _parse_line(record_lines[i])

        if level != 1:
            i += 1
            continue

        if tag == "HUSB":
            husband_id = value.strip()
        elif tag == "WIFE":
            wife_id = value.strip()
        elif tag == "CHIL":
            if value.strip():
                child_ids.append(value.strip())
        elif tag == "MARR":
            subs = _extract_subrecords(record_lines, i, 1)
            date_str = _find_in_subs(subs, "DATE")
            if date_str:
                marriage_date = _parse_date(date_str)
            marriage_place = _extract_place_with_coords(subs)
        elif tag == "DIV":
            subs = _extract_subrecords(record_lines, i, 1)
            date_str = _find_in_subs(subs, "DATE")
            if date_str:
                divorce_date = _parse_date(date_str)

        i += 1

    return GedcomFamily(
        xref_id=xref_id,
        husband_id=husband_id,
        wife_id=wife_id,
        child_ids=child_ids,
        marriage_date=marriage_date,
        marriage_place=marriage_place,
        divorce_date=divorce_date,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_gedcom(content: str) -> GedcomData:
    """Parse raw GEDCOM text into GedcomData."""
    lines = content.splitlines()
    records = _group_records(lines)

    data = GedcomData()

    for record in records:
        if not record:
            continue
        _, xref, tag, _ = _parse_line(record[0])

        if tag == "INDI":
            person = _parse_individual(record)
            data.persons[person.xref_id] = person
        elif tag == "FAM":
            family = _parse_family(record)
            data.families[family.xref_id] = family

    return data


def parse_gedcom_file(file_path: str) -> GedcomData:
    """Read a GEDCOM file from disk and parse it."""
    with open(file_path, encoding="utf-8") as f:
        content = f.read()
    return parse_gedcom(content)
