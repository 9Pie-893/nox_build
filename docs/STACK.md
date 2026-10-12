# NOX Stack Contract

Status: accepted  
Owner: Jake / Ko Pie  
Operator: CODY  
Repo: `9Pie-893/nox_build`

## Decision

NOX ships as a **modular monolith** on the stack below until a domain’s scale, blast radius, or team boundary forces extraction.

## Layers

### 1. Client — consumer + scanner

- Flutter, Dart, Riverpod, GoRouter, Hive, Dio
- Consumer journey screens map 1:1 to DISCOVER → DECIDE → BOOK → ENTER → EXPERIENCE
- Scanner is offline-capable. Local queue of check-ins reconciles when the network returns
- Hive stores session + pending scans. Server ticket row remains source of truth

### 2. Client — dashboards

- Next.js App Router, TypeScript, Tailwind, TanStack Query, React Hook Form, Zod
- Surfaces: organizer, venue, admin
- No business rules that can mint tickets, refund money, or change inventory live only in the browser

### 3. API

- NestJS + TypeScript
- REST + OpenAPI generated from the same DTOs
- class-validator / Zod at the boundary
- Domain modules: Auth, Venues, Events, Tickets, Orders, Payments, Check-ins, Notifications, Analytics
- One deployable API until extraction is justified

### 4. Data

- PostgreSQL is the system of record (Supabase)
- RLS on every tenant-scoped table
- Redis for OTP, rate limits, cache, queues
- Supabase Storage for media; never store secrets in Storage

Authoritative records: users, venues, events, ticket types, tickets, orders, payments, check-ins, audit logs.

### 5. Auth

- Phone OTP is primary in Yangon
- Google / Apple OAuth as secondary
- Short-lived access JWT + rotating refresh tokens
- Roles are capabilities, not strings the client can set
- Admin impersonation is audited and time-boxed if it exists at all

### 6. Tickets + door

- Inventory decrements atomically with order confirmation
- Ticket row in Postgres is the ticket
- QR payload = ticket id + expiry + HMAC-SHA256 over a server secret
- Scanner verifies signature, expiry, status, and replay
- Duplicate scan is a first-class state, not a crash

### 7. Payments

- `PaymentProvider` port + one adapter per rail: KBZPay, WavePay, AYA Pay, CBPay
- Webhooks: verify signature, persist raw event, idempotency key, then mutate order
- Do not invent endpoints. If a rail is undocumented, isolate the adapter and document the gap
- Never treat a client “success” screen as settlement

### 8. Infra

- Docker for local + CI parity
- GitHub Actions for test / lint / build / migrate gates
- Vercel for dashboards
- Cloudflare for edge, DNS, WAF, rate limits
- Supabase Cloud for Postgres + Auth hooks + Storage
- No Kubernetes in MVP. No extra message bus until a queue in Redis is not enough

### 9. Observability + growth

- Sentry for exceptions
- OpenTelemetry traces across API + jobs
- PostHog for product events on the core journey
- Metabase on a read replica / warehouse view, not on the primary write path for heavy exploration
- Structured JSON logs. No secrets in logs

## Explicit non-goals for this stack revision

- Full social graph, chat, live streaming
- ML recommendations as a blocker for Yangon beta
- Merchandise, multi-currency settlement, complex loyalty
- Rewriting Flutter or NestJS from scratch in production

From-scratch work belongs in `stack/*` labs so we understand the primitive. Production uses the contracted libraries above.

## Change control

Changing a row in this table requires an ADR under `docs/adr/` and Jake’s decision.
