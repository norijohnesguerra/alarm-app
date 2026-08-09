# Neon Alarm — Project Plan

A small Android alarm app with dynamic recurring alarms, work-day-aware rescheduling, custom tags with memos, a neon UI, and a companion web app backed by a shared backend and database.

## 1. Data model (the foundation)

Everything else follows from getting this right.

| Table | Fields | Notes |
|---|---|---|
| **users** | id, email, password_hash, created_at | |
| **alarms** | id, user_id, time, days_of_week, tag_id, is_active, snooze_config, created_at, updated_at | `days_of_week` encodes the recurring pattern |
| **tags** | id, user_id, name, color, category, is_system_default | category = work / personal / recreational / custom |
| **memos** | id, tag_id, content, updated_at | short note attached to a tag; shows up when an alarm with that tag fires |
| **work_day_log** | id, user_id, date, is_work_day, answered_at | powers the "is there work today" logic |
| **devices** | id, user_id, push_token, platform | for sync + notifications across Android and web |

## 2. Backend & database

- **Backend**: Node.js + Express, or Python + FastAPI. FastAPI if you want strong typing and auto-generated docs; Express if you want a bigger JS ecosystem to share code with the web app. Exposes a REST API and, ideally, a lightweight WebSocket channel so alarm/tag changes made on web instantly reflect in the Android app and vice versa.
- **Database**: PostgreSQL. Relational fits this data well — users → alarms → tags → memos, with real foreign keys and constraints.
- **Core endpoints**:
  - `/auth/*` — register, login, refresh
  - `/alarms` — CRUD
  - `/tags` — CRUD
  - `/memos` — CRUD, scoped to a tag
  - `/workday/today` — POST answer, triggers the reschedule logic server-side
  - `/sync` — websocket or long-poll for cross-device updates
- **Auth**: JWT-based session with refresh tokens, shared by both clients.

## 3. The "is there work today" logic

This is the trickiest interaction, worth designing deliberately.

1. Each morning (or the night before), the app/backend fires a check-in prompt: "Do you have work today?"
2. The answer is written to `work_day_log`.
3. If **no**: the backend finds all alarms tagged **work** scheduled for that date and shifts them to the next day — respecting whether the next day is itself a work day, so it doesn't cascade forever. Personal/recreational alarms are untouched unless the user opts in.
4. This logic should live **server-side**, not just on-device, so the shift is consistent across Android and web, and survives even if the phone is off when the decision is made.

## 4. Android app

- **Kotlin + Jetpack Compose** for UI.
- **AlarmManager** (`setExactAndAllowWhileIdle`) for the actual wake-up alarms — non-negotiable for reliability; WorkManager alone can't guarantee exact-time firing.
- **WorkManager** for the daily "is there work today" check-in notification and periodic background sync with the backend.
- **Room** as a local cache so alarms/tags still work offline, syncing back to the backend when connectivity returns.
- **Retrofit** for API calls, **DataStore** for session/token storage.

## 5. Web app

- **React** with Tailwind (pairs well with a neon theme via custom color tokens and glow utilities).
- Same feature surface as the Android app: manage alarms, tags, memos, view the work-day history/calendar, and a settings panel.
- Talks to the same backend, so anything touched on web shows up on the phone in real time (or near-real-time via polling if websockets are skipped for v1).

## 6. Design direction — "slick neon"

- Near-black background (`#0a0a0f` or similar), never pure black.
- One or two saturated accent colors per tag category — e.g. electric cyan for work, magenta for personal, lime/green for recreational — used as glowing borders (`box-shadow` blur) on alarm cards rather than filled everywhere, so it stays legible instead of garish.
- A geometric/monospace-adjacent display font for times and headers (e.g. Orbitron, Rajdhani, or Space Grotesk), paired with a clean sans for body text and memos.
- Animated toggle switches and a subtle pulse/glow on the next alarm about to fire.
- Custom tag colors picked by the user, reflected consistently across Android and web.

## 7. Suggested build order

1. **MVP** — local-only Android app: alarms, tags (fixed 3 + custom), memos, Room storage. No backend yet.
2. **Backend + auth + Postgres** — migrate local data up, add login.
3. **Sync layer** — Android app reads/writes through the API instead of just Room.
4. **Web app** — same CRUD, connected to the same backend.
5. **Work-day check-in + auto-reschedule logic**, server-side.
6. **Neon UI pass + polish** — glow effects, animations, custom tag colors, maybe a home-screen widget.

## Assumptions

- Single-user accounts (not shared/family alarms).
- Postgres + Node/FastAPI as the stack. If a lighter setup is preferred, Supabase (Postgres + auth + realtime out of the box) could shortcut steps 2–3 significantly.

## System architecture (overview)

```
Android app (Kotlin, Compose, Room)      Web app (React dashboard)
              \                                /
               \                              /
                v                            v
                    Backend API
              (Auth, alarms, sync, push)
                          |
                          v
                      Database
                      (PostgreSQL)
```
