# 04 — Payments lab

Contract: `PaymentProvider` port. Webhook signature + idempotency before any order mutation.

Must handle: duplicate webhooks, unsigned payloads. Never invent a rail API.
