# Phase 3: Natural Language Search

**Status:** Not started. Plan will be written after Phase 2 completion.

## Scope (from architecture doc)

1. Natural language search text-to-query pipeline
2. LLM integration + prompt engineering
3. Structured output validation (Jackson + custom validator)
4. Dynamic PostGIS query builder
5. Search UI with examples + recent history
6. Rate limiting (100/month hard limit)

## Files to add here

- `implementation.md` — detailed task breakdown (written after Phase 2 completes)
- Any ADRs specific to Phase 3 decisions (e.g., which LLM provider)

## Carried over from earlier phases

Items explicitly deferred during Phase 2 implementation. These are not part of Phase 3's NL search scope but should be folded into Phase 3 planning since Phase 2 will not address them.

### From Task 27 (Report System)

- **`gym_machine` reporting** — `reports.target_type` already supports the value via DB CHECK constraint, but the controller, service, and frontend treat photo as the only target. Phase 3 needs (a) policy decision (does a "wrong machine info" report blind the machine? hide it from search?) and (b) UI entry point.
- **Reporter trust scoring + auto-ban** — current model treats every reporter as weight 1. Phase 3 should track admin disposition (`reports.status` already supports `pending`/`reviewed`/`dismissed`/`actioned`) and lower the weight of reporters whose `dismissed` rate is high. Repeat false reporters get auto-restricted from reporting. Schema: add `users.report_trust_score NUMERIC` or compute on read.
- **Standalone admin tool** — Phase 2 stops at Slack alerts + DB queue (`reports.status = 'pending'`). Phase 3 should provide an admin console for: viewing the pending queue, dispositioning a report (`pending → actioned/dismissed`), restoring a wrongly-blinded photo (`is_blinded = FALSE`), banning an abusive uploader. Likely a thin web UI hitting new admin-only endpoints with `@PreAuthorize("hasRole('ADMIN')")`.
- **Appeal flow for false-positive auto-blinds** — currently blinded photos require admin manual restore. Phase 3 should let the original uploader request review via in-app, surfacing the appeal in the same admin queue.
