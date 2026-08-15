"""Manual status helpers for existing lead and outreach-tracker records.

This module intentionally defines functions only. It never performs work when
imported or executed without a caller invoking a helper explicitly.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

LEADS_TABLE = "lgs_leads"
OUTREACH_TABLE = "lgs_outreach_tracker"
VALID_LEAD_STATUSES = {"new", "verified", "moved", "opted_out", "drafted"}


def _get_supabase() -> Client:
    """Create a client from the required local or workflow environment values."""
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set.")
    return create_client(url, key)


def _utc_timestamp() -> str:
    """Return an RFC 3339 timestamp for audit fields."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def mark_sent(tracker_id: Any) -> None:
    """Mark an existing outreach-tracker draft as sent.

    This records status metadata only; it does not send an email.
    """
    (
        _get_supabase()
        .table(OUTREACH_TABLE)
        .update({"status": "sent", "sent_at": _utc_timestamp()})
        .eq("id", tracker_id)
        .execute()
    )


def log_response(tracker_id: Any, response_text: str) -> None:
    """Store a recipient response against an existing outreach-tracker record."""
    cleaned_response = response_text.strip()
    if not cleaned_response:
        raise ValueError("response_text must not be empty.")
    (
        _get_supabase()
        .table(OUTREACH_TABLE)
        .update({"response_text": cleaned_response, "responded_at": _utc_timestamp()})
        .eq("id", tracker_id)
        .execute()
    )


def mark_opted_out(lead_id: Any) -> None:
    """Suppress a lead from future drafting and assign the approved lead status."""
    (
        _get_supabase()
        .table(LEADS_TABLE)
        .update({"status": "opted_out", "opted_out": True})
        .eq("id", lead_id)
        .execute()
    )
