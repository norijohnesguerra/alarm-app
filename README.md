# Neon Alarm

A work-aware alarm system with a neon-themed **web dashboard**, a **shared REST backend**, and a **Kotlin Android client**. The web app features an interactive analog clock where alarms are drawn as glowing arcs, a paint brush for creating schedules, a calendar with per-date delete, rest/PTO brushes, and full undo/redo.

---

## Summary

Neon Alarm lets you manage recurring and one-time alarms visually on a neon clock face instead of long form lists:

- **Alarms** — single-point alarms with weekly recurrence, tags, labels, lock/toggle, and skip-day exceptions.
- **Arcs** — time-range "blocks" (e.g. a work shift 09:00–17:00) drawn on the clock, generating start/end alarms plus optional lunch and break alarms. Arcs can be painted by dragging the brush across the clock.
- **Calendar** — a month grid showing which days each alarm/arc applies to; you can paint days onto alarms, mark days as **REST** or **PTO**, clear whole dates, and undo/redo every calendar edit.
- **Work-day logic** — answering "is there work today?" suspends (or resumes) work-tagged alarms server-side, shifting them forward to the next scheduled day (up to 14 days), with automatic resume on the chosen date.
- **Two clients, one backend** — the web app and Android app share the same API and database.

---

## Stacks Used

| Layer | Technology |
|---|---|
| **Backend** | Node.js + Express 5, JSON Web Tokens (`jsonwebtoken` + `bcryptjs`), CORS |
| **Database** | SQLite via `sql.js` (file-persisted, `server/neon-alarm.db`), foreign keys + `ON DELETE CASCADE` |
| **Web** | React 19, React Router 7, Vite 6, Tailwind CSS 3, custom neon theme (glow utilities, Orbitron-style display font) |
| **Android** | Kotlin 2.1, Jetpack Compose (Material 3, Navigation), Room 2.6 (local cache), Retrofit 2 + Gson + OkHttp (API), DataStore (session), AlarmManager (exact alarms), WorkManager-ready, coroutines; minSdk 26, target/compile 35 |
| **Android build** | Gradle 8.11.1, AGP 8.7.3, Java 11 bytecode target |
| **Tooling** | `vite build` for the web bundle; Node scripts in `server/` (`npm run dev` = watch mode) |

---

## Repository Layout

```
alarm-app/
├── server/              # Express REST API + SQLite (sql.js)
│   ├── index.js         # app entry, mounts /api routes
│   ├── db/init.js       # schema, migrations, DB persistence
│   ├── routes/          # auth, alarms, arcs, tags, memos, workday, dayEvents
│   └── neon-alarm.db    # SQLite database file (auto-created)
├── web/                 # React + Vite + Tailwind dashboard
│   └── src/
│       ├── pages/       # Login, Dashboard
│       ├── components/  # NeonClock, AlarmCalendar, WorkScheduleModal, ...
│       ├── context/     # AuthContext, WorkDayContext
│       └── lib/api.js   # typed API client for the backend
└── android/             # Kotlin + Jetpack Compose app (com.neonalarm)
    └── app/src/main/java/com/neonalarm/
        ├── data/        # Retrofit API, Room, AlarmReceiver, BootReceiver
        └── ui/          # Compose screens: Login, Dashboard, Alarms, Tags, WorkDay
```

---

## Getting Started

### 1. Backend

```bash
cd server
npm install
npm start          # or: npm run dev (auto-restart on change)
```

Serves the API on `http://localhost:3001` (configurable via `PORT`). The SQLite database file `server/neon-alarm.db` is created automatically on first run.

### 2. Web app

```bash
cd web
npm install
npm run dev        # Vite dev server (default http://localhost:5173)
npm run build      # production bundle -> web/dist
```

### 3. Android app

Open `android/` in Android Studio and run the `app` module on a device/emulator (needs a JDK compatible with Gradle 8.11.1, e.g. JDK 17–21). The app talks to the backend at the base URL configured in `ApiClient.kt`.

> **Note:** the Android build was not completed locally — the installed JDK 25 exceeds the Gradle 8.11.1 compatibility range. Use JDK 17–21 to build.

---

## API Reference

All routes except `auth/*` require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account (email + password), returns JWT |
| POST | `/api/auth/login` | Log in, returns JWT |
| GET | `/api/health` | Health check |
| **Alarms** | | |
| GET | `/api/alarms` | List alarms with their exceptions |
| POST | `/api/alarms` | Create alarm (time, days_of_week, tag_id, label, recurring, start_date, ...) |
| PUT | `/api/alarms/:id` | Update alarm fields |
| DELETE | `/api/alarms/:id` | Delete alarm (cascades to child alarms) |
| PATCH | `/api/alarms/:id/toggle` | Activate / deactivate |
| PATCH | `/api/alarms/:id/lock` | Lock / unlock |
| POST | `/api/alarms/:id/exceptions` | Add a per-date skip exception `{ date }` |
| DELETE | `/api/alarms/:id/exceptions/:date` | Remove a skip exception |
| POST | `/api/alarms/generate-schedule` | Generate a schedule of child alarms for a parent alarm |
| GET/POST | `/api/alarms/recurring` | Recurring-rule list / create |
| DELETE | `/api/alarms/recurring/:id` | Delete a recurring rule |
| **Arcs** | | |
| GET | `/api/arcs` | List arcs with generated alarms + exceptions |
| POST | `/api/arcs` | Create arc (start/end time, mode `single`/`both`, breaks, reminders) — generates its alarms server-side |
| PUT | `/api/arcs/:id` | Update arc (regenerates alarm set) |
| PATCH | `/api/arcs/:id/move` | Slide the arc (time offset in minutes) |
| PATCH | `/api/arcs/:id/toggle` | Activate / deactivate |
| DELETE | `/api/arcs/:id` | Delete arc and its alarms |
| POST | `/api/arcs/:id/exceptions` | Add per-date skip exception |
| DELETE | `/api/arcs/:id/exceptions/:date` | Remove skip exception |
| **Tags & Memos** | | |
| GET/POST | `/api/tags` | List / create tags (unique name, distinct color enforced) |
| PUT/DELETE | `/api/tags/:id` | Update / delete (system defaults protected) |
| GET/PUT | `/api/memos/:tagId` | Read / write the memo attached to a tag |
| **Work day** | | |
| GET | `/api/workday/today` | Today's work-day status (auto-resumes expired suspensions) |
| POST | `/api/workday/answer` | Answer `{ is_work_day: 0 | 1 }` — suspends or resumes alarms |
| GET | `/api/workday/history` | Last 30 answers |
| **Day events** | | |
| GET | `/api/day-events` | All rest/PTO day events |
| PUT | `/api/day-events/:date` | Set `{ type: 'rest' | 'pto' | null }` |

---

## Web App — Functionality Guide

### Authentication
- **Register / Log in** at `/login`; the JWT is stored and sent on every request. Routes are protected — logged-out users are redirected to login.

### Clock & Arcs
- The dashboard is an **analog clock** where each alarm is a glowing dot and each arc is a glowing arc segment between its start and end times.
- **Tap an arc** to open its options: **SLIDE** (drag the arc to a new time), **EDIT** (label, memo, breaks, reminders, repeat weekly), **DELETE** (arc + its alarms on the selected date only).
- **Long-press an alarm** to edit it; long-press an arc for quick actions.
- **Repeat Weekly** is **off by default** for new alarms and arcs — one-time items fire only on their `start_date`; new recurring items start from today.

### Paint Brush
- Pick a tag as the **brush**, then **drag across the clock** — each dragged segment paints an arc of alarms across the times you sweep.
- The clock shows a live preview while painting; release to commit.

### Calendar (month grid)
The calendar shows each day with the alarms/arcs that apply to it, plus color-coded **REST** / **PTO** markers and **work day** fill.

- **Paint days onto alarms** — select alarms, then click day cells to add that weekday to their schedule (undoable).
- **REST DAY / PTO brushes** — select a type, then click dates to mark them (undoable).
- **CLEAR tool** — first click arms date selection, second click deletes every alarm and arc applying on the selected dates (per-date only; other days are untouched).
- **DELETE ALL** — removes every alarm and arc on the currently selected date.
- **Single delete** — deleting one alarm removes it only on the selected date. If it was the last alarm of an arc that day, the arc is wiped for that date too.
- **Per-date delete semantics** — a recurring item gets a *skip exception* for that date (other days untouched); a one-time item, or a recurring item that only ever runs on that weekday, is removed entirely.

### Undo / Redo
- **UNDO / REDO** buttons roll back or re-apply the last calendar edit: day paints, rest/PTO brushes, and all per-date deletes (including skip-exception changes and row deletions). Deleted arcs and alarms are recreated from their snapshots with all links (arc membership, parent/child) restored; redo re-deletes them by their current identity, so multi-cycle undo/redo never leaves duplicates or stale ids behind.

### Alarms
- Create/edit alarms: time, days of week, tag, label, active toggle, **lock** (protect from edits), snooze minutes, recurring vs one-time.
- **Memo** — each tag carries a short note shown in the alarm panel.

### Work Schedule
- The **WORK SCHEDULE** modal generates a full family of child alarms for a parent alarm (start, end, lunch, morning/afternoon breaks, pre-start reminder) via `POST /api/alarms/generate-schedule`.

### Work Day
- **WORK DAY** toggle: answer "work today?" — answering **NO** deactivates today's alarms/arcs and stores a suspension until the next scheduled day (max 14 days out); answering **YES** (or the resume date arriving) reactivates everything. Toggle state is remembered per day.

---

## Android App — Functionality Guide

- **Login screen** — same accounts as the web app (JWT via Retrofit, token kept in DataStore).
- **Dashboard** — today's status: active alarms, arcs, work-day answer.
- **Alarms** — list, create, edit, activate/deactivate, delete; exact alarms scheduled via `AlarmManager`.
- **AlarmReceiver** — fires the alarm notification at the scheduled time; **BootReceiver** re-schedules alarms after device reboot.
- **Tags** — create, recolor, delete, and attach memos.
- **WorkDay screen** — answer today's work-day question; state syncs with the backend.
- **Offline cache** — Room mirrors alarms/tags so the UI works without a connection and syncs when back online.
- Permissions: exact alarms, notifications, boot completion, vibrate, wake lock.

---

## Work-Day Logic (server-side)

1. `POST /api/workday/answer` with `is_work_day: 0` deactivates every alarm and arc scheduled on today's weekday.
2. The suspension's `resume_date` is the first day in the next 14 that is not a logged day off and has at least one alarm scheduled.
3. `GET /api/workday/today` auto-resumes: when the resume date arrives, all alarms/arcs are reactivated, the suspension is cleared, and today is logged as a work day.

---

## Database Schema Highlights

- `users` — auth (bcrypt password hash).
- `alarms` — time, `days_of_week` (e.g. `"1,2,3,4,5"`), tag, active, locked, `recurring` (0 = one-time, 1 = weekly), `start_date`, optional `parent_alarm_id` (children cascade-delete with parent) and `arc_id`.
- `arcs` — start/end time, mode (`single`/`both`), optional lunch/breaks/reminders, `recurring`, `start_date`.
- `alarm_exceptions` / `arc_exceptions` — per-date skips (`UNIQUE(user_id, id, date)`).
- `tags` — name, color (uniqueness + color-distance checks), categories, memos via `memos` table.
- `work_day_log` — per-day work answers; `work_suspension` — active suspension + resume date.
- `day_events` — rest/PTO calendar markers.
- `work_schedules`, `recurring_rules` — schedule-generation and recurrence configuration.

---

## Notes & Limitations

- **Single-user-per-account** model (no shared/family alarms).
- Database is a single SQLite file via `sql.js` (in-process WASM SQLite, written to disk after each write) — fine for one user, not a multi-instance deployment.
- The original plan (`alarm-app-plan.md`) called for PostgreSQL/Supabase; the implementation uses SQLite for zero-setup simplicity.
- The Android app is scaffolded and feature-complete in code but was **not built locally** (JDK 25 incompatible with Gradle 8.11.1; use JDK 17–21).
