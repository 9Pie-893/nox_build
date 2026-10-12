# 01 — Auth lab

Contract: phone OTP primary, short-lived JWT, rotating refresh, capability roles.

This folder is a **failure-mode lab**, not production auth. Ship the real module in the NestJS API.

## What this lab proves

| Attack | Expected result |
|---|---|
| Brute-force OTP | lock after max attempts |
| Expired OTP | reject |
| Client-supplied `admin` role | ignored; role comes from the user record |
| Refresh reuse | family revoked |
| Expired access token | reject until refresh |

## Run

```bash
node --test stack/01-auth/auth.test.mjs
```

Do not copy this crypto into Yangon production. Production uses NestJS + Supabase + a real SMS rail.
