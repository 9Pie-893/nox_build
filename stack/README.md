# Stack labs

Labs exist to expose failure modes. They are not production services.

| Module | Primitive | Production home |
|---|---|---|
| [01-auth](01-auth/) | OTP, JWT, refresh rotation | NestJS auth module |
| [02-events-discovery](02-events-discovery/) | Feed, pagination, cache | Events domain + Flutter discovery |
| [03-inventory-tickets](03-inventory-tickets/) | Atomic inventory, ticket rows | Tickets + orders |
| [04-payments](04-payments/) | Provider port, webhook inbox | Payment adapters |
| [05-qr-checkin](05-qr-checkin/) | HMAC QR, offline queue | Scanner + check-ins |
| [06-dashboards](06-dashboards/) | RBAC loaders | Next.js dashboards |
| [07-observability](07-observability/) | Trace + product events | Sentry / OTel / PostHog |

01-auth and 02-events-discovery have verified labs. Later modules stay contracts until implemented.
