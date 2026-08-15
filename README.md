# Cork Lead Generation System

This repository provides a weekly, GitHub-hosted workflow for identifying qualifying Cork service businesses in Google Maps and drafting concise web-design outreach copy for human review. It **does not send emails** and the included status helper only records operational outcomes in the existing Supabase tables.

## Workflow

The scheduled workflow runs every Monday at 08:00 UTC. It performs nine Google Maps searches, deduplicates records by `place_id`, and writes them to the existing `lgs_leads` table. The drafting step selects leads whose status is `new` and which have not opted out, generates a three-to-four sentence web-design email body, validates it, stores it in `lgs_outreach_tracker`, and changes the lead status to `drafted`.

> The repository deliberately contains no table-creation or migration commands. The existing `lgs_leads` and `lgs_outreach_tracker` tables are the only tables accessed by these scripts; the unrelated `leads` table is never read or written.

## Required secrets

Configure these repository secrets before enabling the workflow:

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

`sql/leads_schema.sql` documents the fields consumed by the scripts. It is **not executable schema setup**. In particular, `lgs_leads.google_place_id` must be uniquely constrained because the ingestion script uses an `on_conflict=google_place_id` upsert.

The lead table must provide a `status` default of `new` for newly inserted rows. Existing rows retain their current status during the upsert. When the upsert response shows that a row existed before the current run, the script changes only an existing `new` status to `verified`. This avoids a preliminary select-then-write pattern and protects `drafted`, `moved`, and `opted_out` records.

## Manual status helpers

Import functions from `scripts/update_status.py` in a deliberate operator workflow:

```python
from scripts.update_status import log_response, mark_opted_out, mark_sent

mark_sent("tracker-row-id")
log_response("tracker-row-id", "Interested — please follow up next week.")
mark_opted_out("lead-row-id")
```

`mark_opted_out` also sets the corresponding lead's `opted_out` flag so future drafting runs exclude it. None of the helpers execute automatically when the module is imported.

## Compliance and review

Generated content is a draft for human review. Before any outreach is sent, verify contact permission, business relevance, factual accuracy, and applicable data-protection and electronic-marketing obligations. Use `mark_opted_out` promptly for suppression requests.

## References

The implementation uses the current SerpApi Python client, Supabase Python client, and Google Gen AI SDK APIs. [SerpApi Python integration](https://serpapi.com/integrations/python), [Supabase Python upsert](https://supabase.com/docs/reference/python/upsert), and [Google Gen AI SDK](https://googleapis.github.io/python-genai/) provide the relevant API references.
