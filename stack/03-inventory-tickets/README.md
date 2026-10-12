# 03 — Inventory + tickets lab

Contract: the server ticket row is the ticket. Inventory moves in the same step as order confirmation.

This folder is a **failure-mode lab**, not production Postgres. Ship orders in a database transaction.

## What this lab proves

| Attack | Expected result |
|---|---|
| Request more seats than remain | whole order rejected; `sold` unchanged |
| Two buyers, one seat left | first confirms; second is `oversell` |
| Same idempotency key, even with a bigger qty | original order returned; no second decrement |
| Client-supplied ticket id | ignored; ids are `tkt_*` from the server |
| Ticket type deleted after sale | issued rows stay; new orders reject |

## Run

```bash
node --test stack/03-inventory-tickets/inventory.test.mjs
```

Do not ship this `Map` as inventory. Production decrements `sold` and inserts ticket rows in one Postgres transaction.
