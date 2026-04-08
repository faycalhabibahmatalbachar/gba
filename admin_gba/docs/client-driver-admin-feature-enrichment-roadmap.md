# Roadmap: client, driver, admin enrichment

## Client mobile app

- Improve voice UX: explicit mic permission states, upload retry, waveform preview.
- Strengthen order tracking: fallback polling if realtime degrades.
- Add connectivity banner: offline queue + sync status.
- Add trust layer: explain why location is required and show consent status.

## Driver mobile app

- Stabilize live GPS: finite lat/lng guards, adaptive frequency by speed.
- Improve assignment flow: clearer order priority and SLA timer.
- Voice/chat reliability: resilient upload buckets and better playback states.
- Safety workflow: one-tap incident report with photo + location context.

## Admin web (`admin_gba`)

- Orders: robust schema fallbacks, better special/quote visualization.
- Deliveries: single source for drivers, assignment modal with consistent data.
- Dashboard: coherent 7/30 day windows, explicit sampled vs total metrics.
- Categories: safe API fallbacks + richer KPI cards and actionable errors.
- Full French labels for statuses and operational actions.

## Platform and observability

- Add unified status translation dictionary shared by API/UI.
- Track latency and failure ratios for critical APIs.
- Add release checklist gates for `/orders`, `/deliveries`, `/dashboard`, `/categories`.
- Maintain incident runbook with audit-linked evidence.
