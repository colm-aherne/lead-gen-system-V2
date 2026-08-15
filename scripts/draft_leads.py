#!/usr/bin/env python3
"""Generate validated web-design email drafts for eligible ``lgs_leads`` rows.

The script never sends email. It writes one reviewed-ready draft to the existing
``lgs_outreach_tracker`` table, then changes the source lead from ``new`` to
``drafted``. It intentionally never reads or writes the unrelated ``leads``
table.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from google import genai
from google.genai import types
from supabase import Client, create_client

LEADS_TABLE = "lgs_leads"
OUTREACH_TABLE = "lgs_outreach_tracker"
MODEL_NAME = "gemini-2.5-flash"
MAX_WORDS = 149
VALID_STATUSES = {"new", "verified", "moved", "opted_out", "drafted"}

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger(__name__)


def require_environment(*names: str) -> dict[str, str]:
    """Return required environment values or stop before API/database activity."""
    values = {name: os.getenv(name, "").strip() for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required environment variable(s): {', '.join(missing)}")
    return values


def normalise_text(text: str) -> str:
    """Return a compact plain-text draft without a subject line or blank padding."""
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    return "\n\n".join(lines)


def sentence_count(text: str) -> int:
    """Count conventional sentence endings after normalising line breaks."""
    return len(re.findall(r"[^.!?]+[.!?](?=\s|$)", re.sub(r"\s+", " ", text)))


def validate_draft(text: str) -> tuple[bool, str]:
    """Enforce the requested no-subject, 3–4 sentence, sub-150-word contract."""
    if not text:
        return False, "Draft is empty."
    if re.search(r"^\s*(subject|re)\s*:", text, flags=re.IGNORECASE | re.MULTILINE):
        return False, "Draft contains a subject line."

    words = re.findall(r"\b[\w'-]+\b", text)
    if len(words) > MAX_WORDS:
        return False, f"Draft has {len(words)} words; it must contain fewer than 150."

    sentences = sentence_count(text)
    if sentences not in {3, 4}:
        return False, f"Draft has {sentences} sentences; it must contain exactly 3 or 4."
    return True, ""


def build_prompt(lead: dict[str, Any]) -> str:
    """Build a compact, factual prompt using only the selected lead fields."""
    business_name = str(lead.get("business_name") or "this business").strip()
    business_type = str(lead.get("business_type") or "local service business").strip()
    website = str(lead.get("website") or "").strip()
    website_context = (
        f"The business website is listed as {website}; do not claim that you reviewed it."
        if website
        else "No website is recorded; do not claim that one exists or is missing."
    )

    return f"""Write only a friendly cold-email body for {business_name}, a {business_type} in Cork, Ireland.
Pitch professional web design services. Keep it factual, personal, and non-pushy.
Use exactly 3 or 4 complete sentences and fewer than 150 words.
Do not include a subject line, greeting label, markdown, bullets, pricing, guarantees, invented business details, or a signature.
{website_context}
Return the email body only."""


def fetch_eligible_leads(supabase: Client) -> list[dict[str, Any]]:
    """Return leads that are new and have not opted out of draft generation."""
    response = (
        supabase.table(LEADS_TABLE)
        .select("id,business_name,business_type,website")
        .eq("status", "new")
        .eq("opted_out", False)
        .execute()
    )
    return response.data or []


def generate_draft(client: genai.Client, lead: dict[str, Any]) -> str:
    """Generate one draft through the current Google Gen AI SDK."""
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=build_prompt(lead),
        config=types.GenerateContentConfig(temperature=0.45, max_output_tokens=350),
    )
    return normalise_text(response.text or "")


def save_draft_and_mark_lead(supabase: Client, lead_id: Any, draft: str) -> None:
    """Persist a validated draft, then mark only its source lead as drafted."""
    (
        supabase.table(OUTREACH_TABLE)
        .insert({"lead_id": lead_id, "draft_body": draft})
        .execute()
    )
    (
        supabase.table(LEADS_TABLE)
        .update({"status": "drafted"})
        .eq("id", lead_id)
        .eq("status", "new")
        .eq("opted_out", False)
        .execute()
    )


def main() -> None:
    """Draft compliant outreach copy for all currently eligible leads."""
    environment = require_environment("SUPABASE_URL", "SUPABASE_KEY", "GEMINI_API_KEY")
    supabase = create_client(environment["SUPABASE_URL"], environment["SUPABASE_KEY"])
    client = genai.Client()

    eligible_leads = fetch_eligible_leads(supabase)
    LOGGER.info("Found %d eligible new lead(s).", len(eligible_leads))

    drafted = 0
    for lead in eligible_leads:
        lead_id = lead.get("id")
        if lead_id is None:
            LOGGER.warning("Skipping lead without an id: %r", lead)
            continue

        draft = generate_draft(client, lead)
        is_valid, reason = validate_draft(draft)
        if not is_valid:
            LOGGER.warning("Skipping lead %s because generated copy failed validation: %s", lead_id, reason)
            continue

        save_draft_and_mark_lead(supabase, lead_id, draft)
        drafted += 1

    LOGGER.info("Saved %d validated draft(s).", drafted)


if __name__ == "__main__":
    main()
