# 02 — Events + discovery lab

Contract: published events only, cursor pagination, cache that dies when an event is unpublished.

This folder is a **failure-mode lab**, not the production feed. Ship discovery in Postgres + Redis + Flutter.

## What this lab proves

| Attack | Expected result |
|---|---|
| Draft or unpublished event | absent from feed and search |
| Cached "tonight" list after unpublish | cache cleared; event gone |
| Publish after a cached miss | cache cleared; event appears |
| Cursor pages | no overlap, stable `startsAt` + id order |
| Search by phone or internal note | zero hits; cards are public fields only |
| Geo radius | events outside the radius dropped |

## Run

```bash
node --test stack/02-events-discovery/discovery.test.mjs
```

Do not ship this Map cache to Yangon. Production uses Postgres as source of truth and Redis with explicit invalidation on publish/unpublish.
