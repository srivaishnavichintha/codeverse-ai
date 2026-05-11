# CodeVerse — Backend Architecture & Database Design

## Table of Contents
1. [Project Structure](#project-structure)
2. [Core Schema Design](#core-schema-design)
3. [ER Relationships](#er-relationships)
4. [Indexes & Optimization](#indexes--optimization)
5. [Stats: Dynamic vs Stored](#stats-dynamic-vs-stored)
6. [Test Case Security](#test-case-security)
7. [API Reference](#api-reference)
8. [Feature Team Extension Guide](#feature-team-extension-guide)
9. [Scalability Notes](#scalability-notes)
10. [Setup & Running](#setup--running)

---

## Project Structure

```
codeverse/
├── migrations/
│   ├── 001_core_schema.sql     # Full PostgreSQL schema + indexes + triggers
│   ├── migrate.js              # Migration runner
│   └── seed.js                 # Sample data (3 problems, 1 admin user)
├── src/
│   ├── app.js                  # Express boot, middleware chain
│   ├── config/
│   │   ├── database.js         # pg Pool — query(), getClient() helpers
│   │   └── redis.js            # Redis client — cacheGet/Set/Del helpers
│   ├── core/
│   │   ├── users/
│   │   │   ├── user.repository.js    # All SQL for users, stats, activity
│   │   │   ├── user.service.js       # JWT auth, bcrypt, business rules
│   │   │   ├── user.controller.js    # Route handlers
│   │   │   └── user.validation.js    # Joi schemas
│   │   ├── problems/
│   │   │   ├── problem.repository.js # SQL — filtering, FTS, tags, versioning
│   │   │   ├── problem.service.js    # Business logic, test-case gate
│   │   │   ├── problem.controller.js
│   │   │   └── problem.validation.js
│   │   ├── submissions/
│   │   │   ├── submission.repository.js # SQL — create, verdict update, leaderboard
│   │   │   ├── submission.service.js    # Queue integration point
│   │   │   ├── submission.controller.js
│   │   │   └── submission.validation.js
│   │   └── discussions/
│   │       ├── discussion.repository.js # SQL — threaded comments, atomic votes
│   │       ├── discussion.service.js
│   │       ├── discussion.controller.js
│   │       └── discussion.validation.js
│   ├── middleware/
│   │   ├── auth.js          # JWT authenticate + role authorize
│   │   ├── errorHandler.js  # Global error boundary
│   │   ├── rateLimiter.js   # express-rate-limit
│   │   └── validate.js      # Joi body validation factory
│   ├── routes/
│   │   ├── index.js          # Mounts all sub-routers under /api/v1
│   │   ├── user.routes.js
│   │   ├── problem.routes.js
│   │   ├── submission.routes.js
│   │   └── discussion.routes.js
│   └── utils/
│       ├── AppError.js   # Operational error class
│       ├── logger.js     # Minimal structured logger
│       └── pagination.js # parsePagination + response helpers
├── tests/
│   ├── users.test.js
│   └── submissions.test.js
├── .env.example
└── package.json
```

---

## Core Schema Design

### 1 — Users Module

| Table | Purpose |
|---|---|
| `users` | Identity, credentials, profile |
| `user_stats` | Denormalised aggregates — rating, solved counts, accuracy |
| `user_activity` | One row per (user × date) — powers the heatmap / streak |
| `refresh_tokens` | Hashed refresh tokens for JWT rotation |

**Key design decision:** `user_stats` is a *materialised summary*. It is never computed on-the-fly in a SELECT. PostgreSQL triggers maintain it on every submission insert. This keeps leaderboard queries at O(1).

---

### 2 — Problems Module

| Table | Purpose |
|---|---|
| `problems` | Core problem data with `version` column |
| `tags` / `problem_tags` | Normalised M:M tag system |
| `problem_examples` | Ordered visible examples shown on the UI |
| `test_cases` | Both visible and hidden; visibility column is the gate |
| `problem_stats` | Denormalised: total attempts, submissions, accepted count |
| `problem_versions` | Full audit trail on every update |

---

### 3 — User–Problem Stats (Bridge Table)

`user_problem_stats` is the most important table for performance:

```sql
PRIMARY KEY (user_id, problem_id)
```

- **"Has user solved problem X?"** → single PK lookup, no aggregation.
- **"Count easy/medium/hard solved"** → maintained in `user_stats` by trigger.
- **"Best runtime for this user on this problem"** → stored here, updated on each AC.

Feature teams can **add columns** to this table (`is_bookmarked`, `notes`, etc.) without touching core logic.

---

### 4 — Submissions Module

| Column | Notes |
|---|---|
| `source_code` | Never returned in list endpoints — only on single-submission GET |
| `verdict` | ENUM — 9 states including `pending` and `running` |
| `judge_metadata` | JSONB — per-testcase results from the judge |
| `error_message` | Truncated compiler/runtime output |

The trigger `after_submission_insert` fires on every insert and atomically updates `user_stats`, `user_problem_stats`, `problem_stats`, and `user_activity`. This means analytics are always consistent without a background job.

---

### 5 — Discussions Module

| Table | Purpose |
|---|---|
| `discussions` | Thread header, linked to a problem |
| `comments` | Threaded via `parent_id` self-reference |
| `votes` | Unique (user, target_type, target_id) — prevents double-voting |

Votes are applied atomically inside a transaction. Toggling a vote removes it; switching direction adjusts both counters.

---

## ER Relationships

```
users ──< user_stats          (1:1, cascades)
users ──< user_activity       (1:many)
users ──< refresh_tokens      (1:many)
users ──< submissions         (1:many)
users ──< discussions         (1:many)
users ──< comments            (1:many)
users ──< votes               (1:many)
users ──< user_problem_stats  (1:many)

problems ──< problem_stats        (1:1, auto-created by trigger)
problems ──< problem_examples     (1:many, ordered)
problems ──< problem_versions     (1:many, audit log)
problems ──< test_cases           (1:many, visible/hidden)
problems ──< problem_tags ──> tags (M:M)
problems ──< submissions          (1:many)
problems ──< discussions          (1:many)
problems ──< user_problem_stats   (1:many)

discussions ──< comments     (1:many, threaded via parent_id)
comments ──< comments        (self-ref, parent_id)

votes → discussions | comments  (polymorphic via target_type + target_id)
```

---

## Indexes & Optimization

### Critical indexes

```sql
-- Leaderboard (sorted by rating or solved)
idx_user_stats_rating   ON user_stats(rating DESC)
idx_user_stats_solved   ON user_stats(total_solved DESC)

-- "Has this user solved problem X?" — PK lookup
PRIMARY KEY (user_id, problem_id) ON user_problem_stats

-- Problem list with filters
idx_problems_difficulty ON problems(difficulty)
idx_problems_fts        ON problems USING GIN(to_tsvector(...))   -- full-text

-- Submission history (user profile page)
idx_submissions_user    ON submissions(user_id, submitted_at DESC)

-- Fastest accepted per problem (leaderboard widget)
idx_submissions_accepted ON submissions(problem_id, runtime_ms)
  WHERE verdict = 'accepted'                                       -- partial index

-- Solved problems fast lookup
idx_ups_solved          ON user_problem_stats(user_id, is_solved)
  WHERE is_solved = TRUE                                           -- partial index
```

### Caching strategy (Redis)

| Key pattern | TTL | Content |
|---|---|---|
| `problems:list:{hash}` | 60s | Paginated problem list |
| `problem:{slug}` | 120s | Single problem detail |
| `leaderboard:global` | 30s | Top-N leaderboard |
| `user:stats:{id}` | 60s | User stats object |
| `problem:tags` | 300s | All tags list |

Cache is invalidated on write. The repository layer is the right place to add cache reads/writes.

---

## Stats: Dynamic vs Stored

| Metric | Approach | Reason |
|---|---|---|
| User total solved | **Stored** in `user_stats` | Queried on every profile view and leaderboard |
| User accuracy % | **Computed** as `accepted / total` | Trivial arithmetic, no JOIN needed |
| Problem acceptance rate | **Computed** as `accepted_count / total_submissions` | Same |
| Problem total_attempts | **Stored** in `problem_stats` | Distinct users — expensive to COUNT DISTINCT |
| Activity heatmap | **Stored** in `user_activity` | 365-day range queries are fast with index |
| Streak | **Stored** in `user_stats` | Requires previous-day logic; best done in a nightly job |
| Per-problem user best runtime | **Stored** in `user_problem_stats` | Needed for the "your best" widget |

---

## Test Case Security

Hidden test cases are **never returned by any public API endpoint**. The gate is enforced at two layers:

1. **Repository layer** — `getVisibleTestCases()` always filters `WHERE visibility = 'visible'`. `getAllTestCases()` exists but is only called from `problemService.getTestCasesForJudge()`.
2. **Service layer** — `getProblem()` (public endpoint handler) only calls `getVisibleTestCases()`. There is no public route that calls `getTestCasesForJudge()`.

The judge service communicates via an **internal endpoint** protected by `x-internal-key` header (see `submission.routes.js`). This key is never exposed to clients.

---

## API Reference

### Auth
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

### Users
```
GET    /api/v1/users/leaderboard
GET    /api/v1/users/me
PATCH  /api/v1/users/me
GET    /api/v1/users/me/activity?days=365
GET    /api/v1/users/me/solved?page=1&limit=20
GET    /api/v1/users/:userId
GET    /api/v1/users/:userId/stats
GET    /api/v1/users/:userId/solved
GET    /api/v1/users/:userId/activity
```

### Problems
```
GET    /api/v1/problems?difficulty=easy&tag=array&search=two+sum&page=1
GET    /api/v1/problems/:slug
POST   /api/v1/problems              (admin)
PATCH  /api/v1/problems/:problemId   (admin)
GET    /api/v1/problems/:problemId/stats   (admin/mod)
GET    /api/v1/problems/tags
```

### Submissions
```
POST   /api/v1/submissions                           (auth)
GET    /api/v1/submissions/me?verdict=accepted
GET    /api/v1/submissions/:submissionId             (auth)
GET    /api/v1/submissions/problem/:problemId
GET    /api/v1/submissions/problem/:problemId/fastest
PATCH  /api/v1/submissions/:submissionId/verdict     (internal key)
```

### Discussions
```
GET    /api/v1/discussions/problem/:problemId?sort=popular
POST   /api/v1/discussions/problem/:problemId        (auth)
GET    /api/v1/discussions/:discussionId
PATCH  /api/v1/discussions/:discussionId             (auth, owner/mod)
DELETE /api/v1/discussions/:discussionId             (auth, owner/mod)
GET    /api/v1/discussions/:discussionId/comments
POST   /api/v1/discussions/:discussionId/comments    (auth)
PATCH  /api/v1/discussions/comments/:commentId       (auth, owner)
DELETE /api/v1/discussions/comments/:commentId       (auth, owner/mod)
POST   /api/v1/discussions/votes                     (auth)
```

---

## Feature Team Extension Guide

### Adding new columns to `user_problem_stats`
This table is the cleanest extension point. Example for a "bookmarks" feature:

```sql
-- Feature migration: 002_bookmarks.sql
ALTER TABLE user_problem_stats
  ADD COLUMN is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN bookmarked_at TIMESTAMPTZ;

CREATE INDEX idx_ups_bookmarked ON user_problem_stats(user_id, is_bookmarked)
  WHERE is_bookmarked = TRUE;
```

The core code never reads these columns — they're invisible to it.

### Adding a new feature module (e.g. Contests)
```
src/
└── features/
    └── contests/
        ├── contest.repository.js
        ├── contest.service.js
        ├── contest.controller.js
        └── contest.validation.js
```

Reference `users.id` and `problems.id` as foreign keys. Register your router in `src/routes/index.js`:

```js
router.use('/contests', require('../features/contests/contest.routes'));
```

Never modify the core module files.

### Extending the user profile
Add columns to `users` in a new migration. The `updateProfile` method in `user.repository.js` uses an allowlist — add your new column name to it if it should be user-editable.

---

## Scalability Notes

- **Read replicas**: The `query()` helper in `database.js` can be swapped for a read/write router (e.g. `pg-pool-cluster`) — all reads in repositories are clearly separated from writes.
- **Submission queue**: `submission.service.js` has a comment marking where a message-queue push (RabbitMQ, SQS, Redis Streams) should go. The judge is a separate worker process.
- **Partitioning**: At 100M+ rows, partition `submissions` by `submitted_at` (monthly ranges). `user_activity` can be partitioned by `active_date` yearly.
- **JSONB for judge metadata**: Keeps the schema flexible for different judge implementations without migrations.
- **No ORM**: Raw `pg` queries give full control over query plans and avoid N+1 issues.

---

## Setup & Running

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL and Redis credentials

# 3. Create database
psql -U postgres -c "CREATE DATABASE codeverse;"

# 4. Run migrations
npm run migrate

# 5. Seed sample data
npm run seed

# 6. Start development server
npm run dev
```

### Docker (optional)
```bash
docker run -d --name pg \
  -e POSTGRES_DB=codeverse \
  -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 postgres:15

docker run -d --name redis \
  -p 6379:6379 redis:7-alpine
```
