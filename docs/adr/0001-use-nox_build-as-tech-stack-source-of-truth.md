# ADR 0001 — Use `9Pie-893/nox_build` as the NOX tech-stack source of truth

Date: 2026-08-28  
Status: accepted  
Decision maker: Jake / Ko Pie

## Context

NOX currently has multiple trees (`pyaiphyopie/NOX`, `Lone-wolf-Ltd/nox-platform`, v0.2 cuts) plus a new fork of build-your-own-x at `9Pie-893/nox_build`.

Without a stack contract, agents and humans will keep inventing frameworks, splitting services early, or treating a tutorial catalog as product scope.

## Decision

1. `9Pie-893/nox_build` is the stack contract and from-scratch lab.
2. Application code does not migrate here.
3. Changing the stack requires a new ADR.
4. Production work continues in the platform repos listed in `docs/REPO_MAP.md`.

## Consequences

- CODY defaults to Flutter / Next.js / NestJS / Supabase / Redis / the payment adapter pattern.
- The BYOX catalog is retired in this fork.
- Risk: people may still commit features here. Mitigate with the README “is / is not” table and empty `stack/*` labs instead of a fake monorepo.
