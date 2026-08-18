# Project TODO

- [x] Replace Cork-only search configuration with a nationwide Ireland location set covering Dublin, Cork, Galway, Limerick, Waterford, and additional major cities and counties.
- [x] Expand and normalize trade and service categories for AI-serviceable prospects, including HVAC, electricians, plumbers, builders, roofers, landscapers, painters, locksmiths, carpet cleaners, and related niches.
- [x] Update Google Maps query construction and GitHub Actions workflow settings to run nationwide searches rather than using a single Cork-centred coordinate.
- [x] Enforce duplicate-outreach safeguards in the ingestion and drafting workflow so leads with a tracker entry or drafted status cannot be drafted or contacted again.
- [x] Validate, commit, and push the updated nationwide automation repository without adding credentials to source control.
- [x] Connect the dashboard server securely to the existing Supabase lgs_leads and lgs_outreach_tracker tables.
- [x] Build a plain, readable leads table with business name, business type, location, phone, website, and lead status.
- [x] Add lead search and status filtering across business name, type, city, and status values new, verified, drafted, moved, and opted_out.
- [x] Add a per-lead detail panel showing full phone, website, address, tracker-sourced AI email draft, and duplicate-contact flags.
- [x] Add protected one-click actions to mark a lead as opted out or contacted while preventing duplicate contact records.
- [x] Add automated tests for lead filtering, tracker-based duplicate prevention, and status mutations.
- [x] Verify the dashboard at desktop and mobile sizes, then save a completion checkpoint.
- [x] Define deterministic website signals for common chatbot providers and display the detected chatbot status on each lead.
- [x] Add a server-side chatbot scan that inspects a lead website without exposing Supabase or service credentials to the browser.
- [x] Filter a dedicated new-leads view to leads with no outreach-tracker entry and a status eligible for first contact.
- [x] Add a bottom-of-dashboard Get more leads action that invokes the approved collection route without creating repeat outreach candidates.
- [x] Add tests for chatbot detection, tracker-based unused-lead filtering, and the new lead-acquisition action.
- [x] Verify the expanded dashboard experience and save an updated checkpoint.
- [x] Add a server-only GitHub Actions workflow-dispatch credential and verify it can access the existing lead-generation repository without exposing its value.
- [x] Add a confirmation-gated Get more leads button that triggers the nationwide workflow directly from the dashboard and reports its queued state.
- [x] Ensure the post-run dashboard view surfaces only tracker-free, never-before-used first-contact candidates.
- [x] Automatically scan eligible lead websites without requiring a per-lead scan button.
- [x] Persist chatbot scan state durably and show only confirmed no-chatbot businesses in the default dashboard list.
- [x] Exclude detected, not-scannable, missing-website, and scan-pending leads from the no-chatbot work queue.
- [x] Add regression tests for automatic scan eligibility and no-chatbot filtering.
- [x] Re-verify the filtered dashboard and save a post-change checkpoint.

POST-CHANGE NOTE: Final automatic no-chatbot-only dashboard checkpoint saved as 99003e3e.

## Post-Rollback Fix

- [x] Restore the dashboard display after rollback to checkpoint 705cbb35 and verify the lead list loads normally.

## All-Ireland Lead Outcomes

- [x] Show confirmed no-chatbot, tracker-free lead candidates from all available Irish locations rather than a Cork-specific view.
- [x] Add a permanent Declined outcome that hides the business from all future active work queues.
- [x] Add a Meeting Booked outcome that records the business as a meeting without treating it as a new prospect.
- [x] Add protected server-side outcome actions and regression tests for permanent hiding, meeting status, and no-chatbot filtering.
- [x] Update the lead table, detail panel, filters, and all-Ireland wording for the new outcomes.
- [x] Verify desktop and mobile behaviour, then save a checkpoint.

- [x] Make the default all-Ireland work queue tracker-free while retaining an optional view for tracked meeting records.
- [x] Save a checkpoint for the all-Ireland lead outcomes update after final validation.

## Repository Synchronization

- [x] Commit and push the verified all-Ireland, no-chatbot, Declined, and Meeting Booked dashboard update to the connected GitHub repository.
- [x] Add the dashboard source to `colm-aherne/lead-gen-system-V2/dashboard/` without changing the existing lead-collection workflow.
