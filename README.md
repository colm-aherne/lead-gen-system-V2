# Ireland Trade & Service Lead Generation System

This repository provides a weekly, GitHub-hosted workflow for identifying qualifying AI-serviceable trade and service businesses across the island of Ireland through Google Maps, then drafting concise outreach copy for human review. It **does not send emails**; sending remains a deliberate manual Gmail step.

## Workflow

The scheduled workflow runs every Monday at 06:00 UTC. It searches every county across the island of Ireland for HVAC contractors, electricians, plumbers, builders, roofers, landscapers, painters, locksmiths, carpet cleaners, property-maintenance firms, pest-control businesses, tree surgeons, drain cleaners, solar installers, and garage-door repair businesses. Results are deduplicated by `google_place_id` before writing to the existing `lgs_leads` table. A manual run can set `draft_leads` to `false` to collect fresh candidates without generating drafts, which is the safe mode used by the dashboard’s Get more leads action.

The drafting step only selects `new`, non-opted-out leads that have **no** row in `lgs_outreach_tracker`. It generates a three-to-four sentence email body, validates it, stores it as `email_draft`, and changes the source lead status to `drafted`. A tracker entry is therefore a hard duplicate-outreach flag: businesses with a prior saved draft are never drafted again automatically. The workflow also has a GitHub Actions concurrency group to prevent overlapping runs.

> The repository deliberately contains no table-creation or migration commands. The existing `lgs_leads` and `lgs_outreach_tracker` tables are the only tables accessed by these scripts; the unrelated `leads` table is never read or written.

## Required secrets

Configure these repository secrets before manually testing or allowing the workflow to run:

| Secret | Used by | Purpose |
| --- | --- | --- |
| `SERPAPI_API_KEY` | `lead_gen_places.py` | Google Maps search access |
| `SUPABASE_URL` | Both scripts | Existing Supabase project URL |
| `SUPABASE_KEY` | Both scripts | Supabase key with access to the two `lgs_*` tables |
| `GEMINI_API_KEY` | `draft_leads.py` | Gemini API access for draft generation |

Copy `.env.example` to `.env` for local use and replace the placeholder values. The `.env` file is excluded from version control.

## Local installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Run the scripts only after deliberately setting valid credentials:

```bash
python scripts/lead_gen_places.py
python scripts/draft_leads.py
```

## Existing table contract

`sql/leads_schema.sql` documents the live fields used by the scripts. It is **not executable schema setup**. In particular, `lgs_leads.google_place_id` must remain unique because the ingestion script uses an atomic `on_conflict=google_place_id` upsert.

New records receive the existing table default of `status='new'`. Existing rows retain their status during the upsert; once an existing `new` row is detected, the script changes it to `verified`. The permitted lead statuses are exactly `new`, `verified`, `moved`, `opted_out`, and `drafted`.

Email drafts are stored in `lgs_outreach_tracker.email_draft`. The manual helper updates the established tracker fields: `email_sent` and `sent_at` when recording a send, and `response_received`, `response_text`, and `response_date` when recording a response.

## Manual status helpers

Import functions from `scripts/update_status.py` in a deliberate operator workflow:

```python
from scripts.update_status import log_response, mark_opted_out, mark_sent

mark_sent("tracker-row-id")
log_response("tracker-row-id", "Interested — please follow up next week.")
mark_opted_out("lead-row-id")
```

`mark_sent` records a send only; it does not send an email. `mark_opted_out` also sets the corresponding lead's `opted_out` flag so future drafting runs exclude it. None of the helpers execute automatically when the module is imported.

## Compliance and review

Generated content is a draft for human review. Before any outreach is sent, verify contact permission, business relevance, factual accuracy, and applicable data-protection and electronic-marketing obligations. Use `mark_opted_out` promptly for suppression requests.

## References

The implementation uses the current SerpApi Python client, Supabase Python client, and Google Gen AI SDK APIs. [SerpApi Python integration](https://serpapi.com/integrations/python), [Supabase Python upsert](https://supabase.com/docs/reference/python/upsert), and [Google Gen AI SDK](https://googleapis.github.io/python-genai/) provide the relevant API references.
