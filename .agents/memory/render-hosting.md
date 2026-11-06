---
name: Worker hosting
description: Confirmed hosting provider for the Telegram polling worker.
---

The Telegram polling worker is intended to run on Render.

**Why:** the user identified Render as the hosting provider for this worker.

**How to apply:** Use Render-specific deployment guidance for this worker unless the user says the hosting provider has changed.

Do not run the Replit-local polling worker while the Render worker is active. Telegram allows one `getUpdates` poller per bot token; concurrent workers cause `Conflict` errors and can interrupt update delivery.

**Why:** a local development worker and the deployed worker competed for the same bot token during verification.

**How to apply:** Before testing the live Render service, stop the local `Telegram Bot Worker` workflow and avoid restarting it until production verification is finished.
