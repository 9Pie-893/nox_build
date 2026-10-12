# 05 — QR + check-in lab

Contract: HMAC-SHA256 credential. The server ticket row is the ticket. Offline scans sync into a conflict state.

This folder is a **failure-mode lab**, not the Flutter scanner.

## What this lab proves

| Attack | Expected result |
|---|---|
| Valid credential, first scan | row becomes `entered` |
| Screenshot of the same QR | `already_entered`; `enteredAt` unchanged |
| Bad signature | rejected; row stays `issued` |
| Signed QR for a missing row | `unknown_ticket`; no row created |
| Expired beyond clock skew | `expired` |
| Within skew after `exp` | still allowed |
| Voided ticket, valid QR | `void` |
| Two offline taps, one ticket | earlier tap enters; the other conflicts |
| Offline `scannedAt` outside the window | `clock_skew`; row unchanged |

## Run

```bash
node --test stack/05-qr-checkin/checkin.test.mjs
```

Do not let the door app treat a decoded QR as admission. Production verifies the signature, then the ticket row, then writes the check-in.
