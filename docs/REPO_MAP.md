# NOX repository map

Last reviewed: 2026-10-12

## Roles

| Repo | Visibility | Role |
|---|---|---|
| `9Pie-893/nox_build` | accessible to this workspace | **Tech-stack source of truth + from-scratch labs** |
| `Lone-wolf-Ltd/nox-platform` | private | Intended production monorepo (org) |
| `pyaiphyopie/NOX` | public | Founder working tree + product artifacts |
| `Lone-wolf-Ltd/nox` | private | Earlier org cut — do not treat as current stack |
| `Lone-wolf-Ltd/noxV0.2` | private | v0.2 org cut |
| `pyaiphyopie/nox_0.2` | private | v0.2 founder cut (`nox-kappa-liard.vercel.app`) |

## How to choose where to commit

1. Stack decision, ADR, or primitive lab → `9Pie-893/nox_build`
2. Production feature (API, Flutter screen, dashboard, migration) → `Lone-wolf-Ltd/nox-platform` once that tree is the active default
3. Until org monorepo is the daily driver, founder execution may still land in `pyaiphyopie/NOX` — say so in the PR, do not silently fork behavior
4. Do not open a fourth production tree

## Observed state (facts, 2026-10-12)

- `nox_build` was a four-file fork of build-your-own-x until this contract landed.
- `Lone-wolf-Ltd/nox-platform` has monorepo roots (`apps/`, `backend/`, `docs/`, turbo) but `apps/` currently only shows `mobile-app`.
- `pyaiphyopie/NOX` is the densest working tree: backend, packages, infrastructure, Flutter artifacts, and product PDFs/DOCX.

Assumption: `pyaiphyopie/NOX` is the most complete execution snapshot today; `nox-platform` is the org home that should absorb it. `nox_build` does not absorb application code.

## Forbidden

- Copying secrets between repos
- Declaring a payment integration complete because an adapter folder exists
- Treating v0.2 Vercel deploys as the stack contract
