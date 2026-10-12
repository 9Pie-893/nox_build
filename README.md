# NOX Tech Stack

**Urban Entertainment Infrastructure · Own The Night**

`9Pie-893/nox_build` is the authoritative **NOX tech-stack contract** and the from-scratch mastery lab for the layers the platform depends on.

> What I cannot create, I do not understand — Richard Feynman.

This repo started as a fork of [codecrafters-io/build-your-own-x](https://github.com/codecrafters-io/build-your-own-x). It is no longer a generic tutorial catalog. It is the stack Jake / Ko Pie and CODY use to decide, learn, and implement NOX correctly.

## What this repo is — and is not

| This repo IS | This repo is NOT |
|---|---|
| Source of truth for the NOX stack | A second production monorepo |
| Contract between product, architecture, and implementation | A replacement for live payment APIs |
| From-scratch labs for primitives we must understand | Fake “completed” platform code |
| Mapping of stack → journey → existing GitHub repos | A dump of secrets, PII, or vendor credentials |

Production application code lives in the platform repos. See [docs/REPO_MAP.md](docs/REPO_MAP.md).

## Core journey

```
DISCOVER → DECIDE → BOOK → ENTER → EXPERIENCE
```

NOX is not an event-listing app. It is the operating layer connecting consumers, venues, organizers/promoters, DJs/artists, communities, and venue operations — starting in Yangon, designed for ASEAN.

## Authoritative stack

| Layer | Choice | Why |
|---|---|---|
| Consumer + scanner | Flutter + Dart + Riverpod + GoRouter + Hive + Dio | One mobile codebase, offline-capable door ops |
| Dashboards | Next.js App Router + TypeScript + Tailwind + TanStack Query + RHF + Zod | Fast organizer/venue/admin surfaces |
| Backend | NestJS + TypeScript + REST + OpenAPI + class-validator | Modular monolith, typed API contract |
| System of record | PostgreSQL via Supabase + RLS + Realtime + Storage | Tickets, inventory, orders, payments, check-ins |
| Cache / jobs | Redis | Rate limits, OTP, job queues, hot discovery |
| Auth | Phone OTP primary + Google/Apple OAuth + short-lived JWT + refresh rotation | Myanmar-first identity |
| Payments | Adapter layer → KBZPay, WavePay, AYA Pay, CBPay | Never invent undocumented APIs |
| Infra | Docker + GitHub Actions + Vercel (web) + Cloudflare + Supabase Cloud | Ship Yangon beta without premature K8s |
| Observability | Sentry + OpenTelemetry + PostHog + Metabase + structured JSON logs | Ops and growth on the same facts |

**Architecture rule:** modular monolith with clean domain boundaries. Do not split Auth / Events / Tickets / Payments / Notifications / Analytics into separate deployable services until scale forces it.

Full contract: [docs/STACK.md](docs/STACK.md).

## Visual identity

| Token | Hex |
|---|---|
| NOX Black | `#070707` |
| Deep Graphite | `#141414` |
| Electric Cyan | `#00AEEF` |
| Neon Violet | `#8B5CF6` |
| Ice White | `#F5F7FA` |
| Emerald Pulse | `#00D68F` |

Typography: Satoshi (primary), Inter (fallback). Dark-first. No generic SaaS chrome. No cheap nightclub templates.

## Non-negotiables

1. Server-side ticket record is authoritative. QR is an HMAC-SHA256 credential, not the ticket.
2. Capability-based RBAC + PostgreSQL RLS. Never trust client-supplied tenant IDs or role claims alone.
3. Payment webhooks: signature verification + idempotency. Adapters only. No invented APIs.
4. Atomic inventory. Transactional orders. Soft deletes + audit logs where money or access is involved.
5. Rate limiting, validation, secret management, PII minimization, replay protection, fraud controls.
6. Correctness → security → reliability → maintainability → performance → cost.

Roles: `consumer` · `organizer` · `venue` · `scanner` · `admin` · `super_admin`

## Repo layout

```
nox_build/
  README.md                 # this contract
  docs/
    STACK.md                # layer-by-layer decisions
    REPO_MAP.md             # which GitHub repo does what
    CURRICULUM.md           # from-scratch modules mapped to NOX
    adr/                    # architecture decision records
  stack/
    01-auth/
    02-events-discovery/
    03-inventory-tickets/
    04-payments/
    05-qr-checkin/
    06-dashboards/
    07-observability/
```

Each `stack/*` module is a lab + contract. Production implementation lands in the platform repos, not as a parallel copy here.

## How CODY uses this repo

1. Treat [docs/STACK.md](docs/STACK.md) as the default stack. Challenge a layer only with a written ADR.
2. Inspect existing platform repos before writing code.
3. Implement in the production repo that owns that surface.
4. Use `stack/*` labs to understand a primitive before depending on it.
5. Never mark unfinished payment, QR, or auth work as done.

## Related repos

- Production monorepo (org): `Lone-wolf-Ltd/nox-platform`
- Founder working tree: `pyaiphyopie/NOX`
- Earlier private cuts: `Lone-wolf-Ltd/nox`, `Lone-wolf-Ltd/noxV0.2`, `pyaiphyopie/nox_0.2`

Details: [docs/REPO_MAP.md](docs/REPO_MAP.md).

## Origins

Forked from the CodeCrafters / Daniel Stefanovic *build-your-own-x* compilation (CC0). The original catalog is replaced here on purpose. The Feynman rule stays. The syllabus is now NOX.
