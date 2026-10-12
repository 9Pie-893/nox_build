# 04 — Payments lab

Contract: a `PaymentProvider` port. Verify the webhook signature, then dedupe, then touch the order.

This folder is a **failure-mode lab**. The signer is local HMAC. It is not KBZPay, WavePay, AYA Pay, or CBPay, and this lab does not invent their APIs.

## What this lab proves

| Attack | Expected result |
|---|---|
| Client "payment success" screen | ignored; order stays `pending` |
| Missing or bad signature | rejected; order unchanged |
| Signed `settled` event with matching amount | one settlement; order `paid` |
| Same `eventId` delivered again | replay; still one settlement |
| Signed event with the wrong amount | rejected; a later correct event can still settle |
| Second event id after paid | `already_paid`; no second settlement |
| Webhook before the order exists | no order invented; the same event can apply once the order is there |

## Run

```bash
node --test stack/04-payments/payments.test.mjs
```

Production adapters implement the same verify-then-mutate order against the real rail's documented signature. If a rail is undocumented, leave the adapter empty and record the gap. Never treat a return URL as settlement.
