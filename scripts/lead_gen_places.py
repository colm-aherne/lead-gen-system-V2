#!/usr/bin/env python3
"""Collect nationwide Ireland trade-business leads from Google Maps into ``lgs_leads``.

The script performs one Google Maps search per configured category, deduplicates
results by Google ``place_id``, and uses a bulk Supabase upsert with
``on_conflict=google_place_id``. It intentionally never accesses the unrelated
``leads`` table.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import serpapi
from dotenv import load_dotenv
from supabase import Client, create_client

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Loads a local, gitignored .env without overriding GitHub Actions secrets.
load_dotenv(ROOT / ".env")

from config.search_queries import SEARCH_AREAS, SEARCH_QUERIES

LEADS_TABLE = "lgs_leads"
VALID_STATUSES = {"new", "verified", "moved", "opted_out", "drafted"}

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger(__name__)


def require_environment(*names: str) -> dict[str, str]:
    """Return required environment values or fail before any network request."""
    values = {name: os.getenv(name, "").strip() for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required environment variable(s): {', '.join(missing)}")
    return values


def utc_now() -> datetime:
    """Return a timezone-aware timestamp suitable for Supabase timestamptz columns."""
    return datetime.now(timezone.utc)


def isoformat_utc(value: datetime) -> str:
    """Format a UTC datetime in RFC 3339 form."""
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_timestamp(value: str | None) -> datetime | None:
    """Parse a Postgres/Supabase timestamp without assuming a specific precision."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        LOGGER.warning("Could not parse created_at value: %r", value)
        return None


def normalise_place(place: dict[str, Any], category: str, seen_at: str) -> dict[str, Any] | None:
    """Map a SerpApi Google Maps result to the existing ``lgs_leads`` contract."""
    place_id = place.get("place_id")
    business_name = place.get("title") or place.get("name")
    if not place_id or not business_name:
        LOGGER.warning("Skipping Google Maps result without place_id or title: %r", place)
        return None

    address = place.get("address")
    if not address:
        LOGGER.warning("Skipping %s without an address: %s", business_name, place_id)
        return None

    business_type = place.get("type") or place.get("category") or category
    return {
        "business_name": business_name,
        "address": address,
        "phone": place.get("phone"),
        "website": place.get("website") or place.get("link"),
        "business_type": business_type,
        "google_place_id": place_id,
        "last_seen_at": seen_at,
    }


def search_category(
    client: serpapi.Client, category: str, area: dict[str, str], seen_at: str
) -> list[dict[str, Any]]:
    """Run one county-centred Google Maps query for a configured service category."""
    result = client.search(
        {
            "engine": "google_maps",
            "q": f"{category} in {area['name']}",
            "ll": area["ll"],
            "type": "search",
        }
    )
    places = result.get("place_results") or result.get("local_results") or []
    if not isinstance(places, list):
        LOGGER.warning("Unexpected Google Maps result format for %s", category)
        return []

    mapped: list[dict[str, Any]] = []
    for place in places:
        if isinstance(place, dict):
            lead = normalise_place(place, category, seen_at)
            if lead:
                mapped.append(lead)
    LOGGER.info("%s in %s: collected %d qualifying map result(s)", category, area["name"], len(mapped))
    return mapped


def deduplicate_by_place_id(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep one payload per Google place ID across all category searches."""
    deduplicated = {lead["google_place_id"]: lead for lead in leads}
    return list(deduplicated.values())


def is_existing_new_lead(row: dict[str, Any], run_started_at: datetime) -> bool:
    """Identify a pre-existing ``new`` row from the atomic upsert response.

    New inserts receive the table's ``status='new'`` default. Existing records
    retain their stored status because ``status`` is intentionally omitted from
    the upsert payload. A returned ``created_at`` before this run started proves
    that the record existed before the upsert, allowing the subsequent targeted
    update to change only existing ``new`` records to ``verified``.
    """
    if row.get("status") != "new":
        return False
    created_at = parse_timestamp(row.get("created_at"))
    return created_at is not None and created_at < run_started_at


def upsert_leads(supabase: Client, leads: list[dict[str, Any]], run_started_at: datetime) -> None:
    """Atomically merge leads and promote existing ``new`` records to ``verified``."""
    if not leads:
        LOGGER.info("No qualifying leads found; no database write is required.")
        return

    # Omitting status preserves an existing status while allowing the table's
    # default (new) to be applied to first-time inserts.
    response = (
        supabase.table(LEADS_TABLE)
        .upsert(leads, on_conflict="google_place_id")
        .execute()
    )
    returned_rows = response.data or []

    existing_new_ids = [
        row["google_place_id"]
        for row in returned_rows
        if isinstance(row, dict)
        and row.get("google_place_id")
        and is_existing_new_lead(row, run_started_at)
    ]

    if existing_new_ids:
        (
            supabase.table(LEADS_TABLE)
            .update({"status": "verified"})
            .in_("google_place_id", existing_new_ids)
            .eq("status", "new")
            .execute()
        )

    LOGGER.info(
        "Upserted %d unique lead(s); promoted %d existing new lead(s) to verified.",
        len(leads),
        len(existing_new_ids),
    )


def main() -> None:
    """Collect all nationwide categories and areas into ``lgs_leads``."""
    environment = require_environment("SERPAPI_API_KEY", "SUPABASE_URL", "SUPABASE_KEY")
    run_started_at = utc_now()
    seen_at = isoformat_utc(run_started_at)

    search_client = serpapi.Client(api_key=environment["SERPAPI_API_KEY"])
    supabase = create_client(environment["SUPABASE_URL"], environment["SUPABASE_KEY"])

    collected: list[dict[str, Any]] = []
    for area in SEARCH_AREAS:
        for category in SEARCH_QUERIES:
            collected.extend(search_category(search_client, category, area, seen_at))

    unique_leads = deduplicate_by_place_id(collected)
    upsert_leads(supabase, unique_leads, run_started_at)


if __name__ == "__main__":
    main()
