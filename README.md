# Real-Time Client Project Dashboard

A dashboard a small agency uses internally to manage client projects, assign
tasks, and watch team activity as it happens. Three roles (Admin, Project
Manager, Developer) see different slices of the same data, enforced on the
API itself rather than hidden in the UI.

## Stack

- **Frontend:** React 18 + TypeScript, Vite, React Router, TanStack Query for
  server state caching, `socket.io-client` for the live feed.
- **Backend:** Node.js + Express + TypeScript.
- **Database:** PostgreSQL via Prisma.
- **Real-time:** Socket.io.
- **Scheduled job:** node-cron.

## Local setup (Docker)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

This starts Postgres, the API (port 4000), and the frontend dev server
(port 5173). On first run, apply the schema and seed data:

```bash
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run seed
```

Then open http://localhost:5173. Seeded logins (password `Password123!` for
all of them):

| Role      | Email                    |
|-----------|--------------------------|
| Admin     | admin@velozity.dev       |
| PM        | ravi.pm@velozity.dev     |
| PM        | meera.pm@velozity.dev    |
| Developer | karan.dev@velozity.dev   |
| Developer | priya.dev@velozity.dev   |
| Developer | arjun.dev@velozity.dev   |
| Developer | sana.dev@velozity.dev    |

## Local setup (without Docker)

Requires a local PostgreSQL instance.

```bash
cd backend
npm install
cp .env.example .env   # point DATABASE_URL at your local Postgres
npx prisma migrate dev --name init
npm run seed
npm run dev             # http://localhost:4000

cd ../frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

## Database schema

User (id, email, passwordHash, name, role, createdAt)
role: ADMIN | PM | DEVELOPER

RefreshToken (id, userId -> User, expiresAt, revokedAt, createdAt)

Client (id, name, contactEmail, createdAt)

Project (id, name, description, clientId -> Client, managerId -> User, createdAt)

Task (id, title, description, projectId -> Project, assigneeId -> User,
status, priority, dueDate, isOverdue, createdAt, updatedAt)
status: TODO | IN_PROGRESS | IN_REVIEW | DONE
priority: LOW | MEDIUM | HIGH | CRITICAL

ActivityLog (id, taskId -> Task, projectId -> Project, userId -> User,
fromStatus, toStatus, createdAt)

Notification (id, userId -> User, type, message, relatedTaskId -> Task,
isRead, createdAt)


**Indexing decisions**

- `Project.managerId` and `Project.clientId` — every PM-scoped query is
  "projects where managerId = me," and client pages filter by clientId.
- `Task.projectId` — a project's task list is the single most common query.
- `Task(assigneeId, priority)` — a composite index because the developer
  dashboard's defining query is "my tasks, sorted by priority then due
  date"; the composite lets Postgres use one index instead of scanning by
  assignee and re-sorting in memory.
- `Task.status` / `Task.dueDate` — both are filtered directly (status
  filters, due-date range filters) and `dueDate` is also what the overdue
  cron job scans every run.
- `ActivityLog(projectId, createdAt)` and `(taskId, createdAt)` — feed
  queries are always "latest N for scope X," so the scope column and the
  sort column are indexed together rather than separately.
- `Notification(userId, isRead)` and `(userId, createdAt)` — the bell
  always asks for one user's unread count or their most recent N.
- `ActivityLog.projectId` is denormalized onto the row (rather than only
  reachable via `task.project`) so the admin global feed and a project's
  feed can both query `ActivityLog` directly with one indexed scan instead
  of joining through `Task` on every row.

## Architectural decisions

**Backend framework: Express, not Fastify.** Fastify's edge (schema-based
validation and serialization built into the routing layer, lower request
overhead) matters most at high request volume; this app's load is an
internal agency tool with a handful of concurrent users; not a
high-throughput public API. Express's tradeoff is the opposite one: a
smaller, more universally understood API and the largest middleware
ecosystem, which matters more here because the two things this backend
does that aren't plain REST — cookie-based refresh tokens and a Socket.io
server sharing the same HTTP server instance — both have the most
battle-tested middleware and examples built against Express. Validation is
handled explicitly with zod (`middleware/validate.ts`) rather than relying
on a framework feature, so Fastify's built-in schema validation wouldn't
have saved much here anyway.

**WebSocket library: Socket.io, not a raw `ws` server.** The spec requires
room-scoped delivery (per-project viewers, per-role feeds, per-user
notifications) and a reconnect-with-catchup story. Socket.io gives rooms,
automatic reconnection with exponential backoff, and a clean per-connection
auth hook (`io.use`) out of the box; hand-rolling that on raw `ws` would
mean rebuilding a room registry and a reconnection protocol that already
exists and is well-tested. The tradeoff is a slightly heavier client
payload and a protocol that isn't plain WebSocket on the wire — acceptable
here since both ends are controlled by this codebase.

**Job scheduler: node-cron, not Bull/BullMQ.** There is exactly one
background job (sweep for overdue tasks every 5 minutes) with no retries,
no per-job payloads, and no need for a job dashboard. Bull/BullMQ would add
a Redis dependency purely to run one interval query — node-cron does the
same thing in-process with no extra infrastructure. If this app grows more
background work with retry/backoff needs (e.g. sending real emails), that's
the point to introduce a real queue.

**Token storage: access token in memory, refresh token in an HttpOnly
cookie.** The access token never touches `localStorage` or any JS-readable
storage, so it isn't a target for XSS token theft; it lives in a module
variable on the frontend and is attached as a `Bearer` header. The refresh
token is scoped to `/api/auth` with `httpOnly`, `sameSite=lax`, and
`secure` in production, so it's invisible to page scripts and only sent to
the one route that needs it. Refresh tokens are stored server-side as rows
(`RefreshToken`), so a single session can be revoked (logout, or automatic
rotation on every refresh) without invalidating every other device.

**Role enforcement at the data layer, not just the route layer.**
`services/access.service.ts` is the single place that answers "can this
user touch this project/task," used identically by REST routes and by the
socket `project:join` handler. A developer who edits their JWT's role
claim still fails signature verification; a developer with a *legitimately
issued* developer token hitting `GET /api/tasks/:id` for someone else's
task gets a 404 (not a 403 — the resource is made to look like it doesn't
exist, so scope isn't leaked by contrasting error codes), because
`getTaskOrThrow` checks `assigneeId` before returning anything.

**Missed-event catchup.** The client requests this explicitly over the
socket (an `activity:catchup` emit with an ack callback) once its own
listeners are registered, rather than the server pushing it the instant
the connection opens — a push sent that early can arrive before the
client's listener is attached and be silently dropped, since Socket.io
doesn't buffer application events for a not-yet-registered handler. Every
request is answered from `ActivityLog`, scoped to that user's role, never
served out of an in-memory buffer that would be empty after a server
restart or a two-day absence.

## Deployment note

The brief asks for the application to be hosted on Vercel. Vercel's
serverless functions can't hold a persistent WebSocket connection open, so
this backend (Socket.io on a long-running Node process) can't run there.
The frontend is deployed to Vercel as specified; the backend + Postgres are
deployed to Railway, which supports long-lived connections. This is a
deliberate consequence of the WebSocket requirement, not an oversight.

## Known limitations

- No password-reset flow — an Admin creates users directly (`POST
  /api/users`) and shares the password out of band.
- The socket auth handshake uses the access token captured at connect
  time; on access-token refresh the socket is not proactively
  reconnected, so a socket can outlive its original token until the next
  natural reconnect. Access tokens are short-lived (15 min) so the window
  is small, but a production version would re-auth the socket on token
  refresh.
- No pagination on task/notification lists — fine at seed-data scale, not
  at thousands of rows.
- No file attachments on tasks.
- No automated test suite included given the time budget; manual test
  paths are described above under local setup.

## Explanation (for the submission form)

The hardest part was the role-filtered real-time feed: three roles needed
three different slices of the same event stream, live, plus a correct
catch-up story for anyone who was offline. I solved it by giving every
socket connection role-appropriate room memberships at connect time (an
admin joins a global room, a PM joins a room keyed to their own id, a
developer only gets their personal room) and by emitting each `ActivityLog`
write to exactly the rooms that should see it — the project room for
active viewers, the admin room, the owning PM's room, and the assignee's
room. Catch-up is never served from memory: on connect, the server queries
`ActivityLog` scoped by the same role rules and sends the last 20 rows
before any live event arrives, so a restart or an offline stretch never
loses history. The access-control logic (`access.service.ts`) is shared
between REST routes and the socket's `project:join` handler, so a
project's visibility rules can't drift between the two transports.

One thing I'd do differently: re-authenticate the socket connection
whenever the access token refreshes, instead of only at initial connect.
Right now a long-lived tab relies on the token still being valid for the
socket's handshake; reconnecting the socket on every token refresh would
close that gap cleanly.