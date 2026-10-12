# From-scratch curriculum — mapped to NOX

The original build-your-own-x list is replaced with modules that make NOX engineers dangerous in the right way.

Rule: rebuild the primitive in `stack/<module>` until the failure modes are obvious. Then use the production library named in [STACK.md](STACK.md). Do not ship the lab implementation to Yangon doors.

## Order

### 01 Auth

Rebuild: OTP challenge, one-time code store with TTL, JWT sign/verify, refresh rotation, reuse detection.

NOX production: NestJS auth module + Supabase + phone OTP provider.

Failure modes we must own: SMS delay, code brute force, refresh theft, role elevation via client claims.

### 02 Events + discovery

Rebuild: feed query, geo/time filters, cursor pagination, cache invalidation when an event publishes.

NOX production: Postgres + Redis cache + Flutter discovery + PostHog funnels.

Failure modes: stale “tonight” feed, leaked unpublished events, unfiltered PII in search.

### 03 Inventory + tickets

Rebuild: ticket-type inventory, atomic decrement, order state machine, idempotent create.

NOX production: Postgres transactions, ticket rows as source of truth.

Failure modes: oversell, double purchase on retry, client-invented ticket IDs.

### 04 Payments

Rebuild: provider port, webhook inbox, signature check, idempotency key, order transition.

NOX production: KBZPay / WavePay / AYA Pay / CBPay adapters.

Failure modes: replayed webhooks, unsigned callbacks, marking paid before settlement.

### 05 QR + check-in

Rebuild: HMAC credential, expiry, replay cache, offline queue, sync conflict (“already entered”).

NOX production: Flutter scanner + server check-in API.

Failure modes: screenshot QR reuse, clock skew, offline double-entry, trusting the QR without the row.

### 06 Dashboards

Rebuild: nothing exotic. Practice App Router + Zod + RBAC-aware loaders.

NOX production: Next.js organizer / venue / admin.

Failure modes: IDOR on event IDs, leaking other venues’ payout data.

### 07 Observability

Rebuild: structured log schema, trace id propagation, a single product event taxonomy for the core journey.

NOX production: Sentry + OTel + PostHog + Metabase.

Failure modes: logging tokens, unusable dashboards, metrics that cannot answer “did BOOK complete?”

## Deferred labs (not MVP)

OS, compilers, 3D engines, blockchains, regex engines — useful generally, not the path to Yangon beta.
