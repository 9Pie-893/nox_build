# 03 — Inventory + tickets lab

Contract: ticket row in Postgres is the ticket. Inventory moves in the same transaction as order confirmation.

Must handle: oversell, retried creates, deleted ticket types with live holders.
