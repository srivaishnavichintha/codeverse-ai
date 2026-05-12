# CodeVerse — Backend Architecture

> Node.js + Express + MongoDB  
> Designed for millions of users, modular feature extension, and high-performance analytics.

---

## Quick Start

```bash
cp .env.example .env       # fill in MONGO_URI, JWT_SECRET, ANTHROPIC_API_KEY, REDIS_HOST
npm install
npm run seed               # loads sample data
npm run dev                # starts dev server on :5000

# In a separate terminal — start the AI background worker
node src/jobs/queue.worker.js
```

---

## Environment Variables

```env
# Core
MONGO_URI=mongodb://localhost:27017/codeverse
JWT_SECRET=your_jwt_secret

# AI Interview
GROQ_API_KEY=your_anthropic_key
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                        # optional

# Interview tuning
INTERVIEW_CREDIT_COST=10
CODING_DEADLINE_MINUTES=90
AI_WORKER_CONCURRENCY=2
```

---

## Folder Structure

```
codeverse/
├── src/
│   ├── server.js                    # Entry point
│   ├── app.js                       # Express app (middleware, routes)
│   ├── config/
│   │   ├── db.js                    # MongoDB connection (pooled)
│   │   └── seed.js                  # Dev seed data
│   ├── models/
│   │   ├── User.js                  # Users, stats, activity, ratings
│   │   ├── Problem.js               # Problems, versioning, analytics
│   │   ├── TestCase.js              # Visible + hidden test cases
│   │   ├── Submission.js            # All submissions (append-only)
│   │   ├── UserProblemStats.js      # Bridge: per-user-per-problem stats
│   │   ├── Discussion.js            # Discussions, Comments, Votes
│   │   ├── InterviewSession.js      # AI interview session lifecycle  ✦ new
│   │   ├── InterviewQuestion.js     # AI-generated questions + answers ✦ new
│   │   ├── AIResponse.js            # Full AI call log (audit trail)  ✦ new
│   │   └── CreditTransaction.js     # Credit debit/credit ledger       ✦ new
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── problemController.js
│   │   ├── submissionController.js
│   │   ├── discussionController.js
│   │   ├── interviewController.js   # Interview lifecycle              ✦ new
│   │   ├── aiController.js          # Questions, report, AI logs       ✦ new
│   │   └── creditController.js      # Balance + transactions           ✦ new
│   ├── routes/
│   │   └── index.js                 # All API routes (extended)        ✦ updated
│   ├── middleware/
│   │   ├── auth.js                  # JWT protect + role authorize
│   │   └── errorHandler.js          # Central error handler
│   ├── services/
│   │   ├── StatsService.js          # Aggregated stats updater
│   │   ├── InterviewService.js      # Interview orchestration          ✦ new
│   │   ├── AIService.js             # Anthropic API wrapper            ✦ new
│   │   ├── CreditService.js         # Atomic credit operations         ✦ new
│   │   └── QueueService.js          # BullMQ queue producer            ✦ new
│   ├── jobs/                                                           ✦ new folder
│   │   ├── aiAnalysis.job.js        # BullMQ job processor
│   │   └── queue.worker.js          # Worker process (run separately)
│   └── utils/                                                          ✦ new folder
│       ├── aiPrompts.js             # Prompt builders
│       └── aiParser.js              # Zod validation for AI responses
├── package.json
├── .env.example
└── README.md
```

---

## AI Interview Feature

### How It Works

The interview runs in two sequential phases.

**Phase 1 — Coding Round**

The system assigns 3 problems (one easy, one medium, one hard). The user submits code through Judge0; each result is recorded against the session. Once the user calls the qualify endpoint, the system checks whether they solved ≥ 2 problems. If yes, the AI phase begins. If no, the session closes and a partial credit refund is issued.

**Phase 2 — AI Interview**

A BullMQ job fires asynchronously. It sends the user's actual submitted code to the Anthropic API, which generates 2–3 targeted questions based on complexity, edge cases, and approach. The user answers each question; every answer is queued for evaluation. Once all answers are evaluated, a final report is generated automatically — with an overall score, strengths, weaknesses, and a hire recommendation.

**Credits**

10 credits are deducted when the interview starts (configurable via `INTERVIEW_CREDIT_COST`). If the user does not qualify for the AI phase, 5 credits are refunded. All credit operations are atomic (MongoDB transactions).

### Interview Flow Diagram

```
POST /interview/start
        │  deduct credits, assign 3 problems
        ▼
POST /interview/:id/submit-code  (× up to 3)
        │  record Judge0 result per problem
        ▼
POST /interview/:id/qualify
        │  solvedCount >= 2?
        ├── NO  → status: failed, partial refund
        └── YES → status: ai_phase
                    │
                    ▼  (BullMQ job queued)
              AIService.analyzeAndGenerateQuestions()
                    │  Claude reads submitted code
                    ▼
              2–3 InterviewQuestion docs created
                    │
GET /ai/sessions/:id/questions  ← client polls
                    │
POST /interview/:id/answer  (per question)
                    │  answer queued for evaluation
                    ▼
              AIService.evaluateAnswer()
                    │  score 0–10 + feedback stored
                    ▼  (when all answered + evaluated)
              AIService.generateFinalReport()
                    │
GET /ai/sessions/:id/report
```

---

## Schema Design Reference

### Collections Overview

| Collection | Purpose | Scale Notes |
|---|---|---|
| `users` | Profiles, stats, activity heatmap | Index on `rating`, `country` |
| `problems` | Problem bank with embedded analytics | Text index for search |
| `testcases` | Separate collection — hidden cases never exposed | Index on `problem + isHidden` |
| `submissions` | Append-only judge log | Largest collection — archive old entries |
| `userproblemstats` | Bridge table: per-user-per-problem stats | Sparse — created on first attempt |
| `discussions` | Problem discussion threads | |
| `interviewsessions` | One per interview attempt, full lifecycle | Index on `user + status` |
| `interviewquestions` | AI-generated Q&A with evaluations | Index on `session + questionNumber` |
| `airesponses` | Full prompt + raw + parsed AI output | Audit log — never deleted |
| `credittransactions` | Immutable credit ledger | Index on `user + createdAt` |

### Aggregated Stats vs Dynamic Compute

**Decision: Store aggregated stats, not compute dynamically.**

| Metric | Storage Location | Update Trigger |
|---|---|---|
| `User.stats.totalSolved` | User doc | After first AC on a problem |
| `User.stats.totalSubmissions` | User doc | After every verdict |
| `User.stats.accuracy` | Virtual (computed from stored counts) | — |
| `Problem.analytics.acceptanceRate` | Virtual | — |
| `Problem.analytics.totalAttempted` | Problem doc | After first submission per user |
| `UserProblemStats.isSolved` | Bridge doc | After first AC |

**Why stored aggregates?**
- `SELECT COUNT(*)` over 100M submissions = 100–500ms even with indexes.
- Stored field read = < 1ms.
- Tradeoff: eventual consistency if a job crashes mid-update.
- Solution: `StatsService` uses atomic `$inc` + a periodic `reconcileUserStats()` cron.

### Hidden Test Case Security

```
Client (Browser/App)
        │
        ▼
  GET /api/problems/:slug
        │
        ▼
  problemController.js
    └── TestCase.find({ isHidden: false })   ← only sample cases
        TestCase.find({ isHidden: true })    ← NEVER called from API layer
                                              ← only Judge Service (internal)
```

Test cases live in a **separate collection** — impossible to accidentally leak them via `populate()` on the Problem document.

### "Has User Solved Problem X?" — O(1) Pattern

```
❌ Slow:  Submission.findOne({ user, problem, verdict: 'Accepted' })
           → index scan, 50–200ms at scale

✅ Fast:  UserProblemStats.findOne({ user, problem })
           → compound index lookup, < 5ms
           → returns isSolved, totalAttempts, bestRuntimeMs
```

### Activity Heatmap

Stored as a sparse array inside the User document:
```json
"activity": [
  { "date": "2024-01-15", "count": 3 },
  { "date": "2024-01-16", "count": 7 }
]
```
Updated via `$inc` on `activity.$.count` after every submission.  
A cron job prunes entries older than 1 year to keep the array bounded.

---

## API Endpoints

### Auth
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | JWT |

### Users
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/users/leaderboard` | Public |
| GET | `/api/users/:username` | Public |
| GET | `/api/users/:username/activity` | Public |
| GET | `/api/users/:username/submissions` | JWT |
| PATCH | `/api/users/me` | JWT |

### Problems
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/problems` | Optional JWT |
| GET | `/api/problems/:slug` | Optional JWT |
| POST | `/api/problems` | Admin/Mod |
| PATCH | `/api/problems/:id` | Admin/Mod |
| POST | `/api/problems/:id/testcases` | Admin only |

### Submissions
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/submissions` | JWT |
| GET | `/api/submissions/:id` | JWT |
| GET | `/api/problems/:problemId/submissions` | JWT |

### Discussions
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/problems/:problemId/discussions` | Public |
| POST | `/api/problems/:problemId/discussions` | JWT |
| GET | `/api/discussions/:id/comments` | Public |
| POST | `/api/discussions/:id/comments` | JWT |
| POST | `/api/discussions/:id/vote` | JWT |

### Interview
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/interview/start` | JWT | Start session, deduct credits |
| GET | `/api/interview/:sessionId` | JWT | Full session + questions |
| GET | `/api/interview/:sessionId/status` | JWT | Lightweight status poll |
| POST | `/api/interview/:sessionId/submit-code` | JWT | Record a problem submission |
| POST | `/api/interview/:sessionId/qualify` | JWT | Check coding round result |
| POST | `/api/interview/:sessionId/answer` | JWT | Submit answer to AI question |
| GET | `/api/interview/:sessionId/job/:jobId` | JWT | Check BullMQ job status |

### AI
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/ai/sessions/:sessionId/questions` | JWT | List all generated questions |
| POST | `/api/ai/sessions/:sessionId/questions/:questionId/adaptive` | JWT | Trigger adaptive follow-up |
| GET | `/api/ai/sessions/:sessionId/report` | JWT | Final interview report |
| POST | `/api/ai/sessions/:sessionId/report/generate` | JWT | Manually trigger report |
| GET | `/api/ai/sessions/:sessionId/logs` | Admin | Raw AI call audit log |

### Credits
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/credits/balance` | JWT | Current balance |
| GET | `/api/credits/transactions` | JWT | Paginated history |
| POST | `/api/credits/grant` | Admin | Grant credits to a user |
| POST | `/api/credits/deduct` | Admin | Deduct credits from a user |

---

## How Feature Teams Extend the Schema Safely

Core collections are **stable contracts** — feature teams never modify them.  
Instead they create their own collections that **reference** core IDs.

### Example: Contest Feature Team

```js
// contests/models/Contest.js
const ContestSchema = new mongoose.Schema({
  title: String,
  problems: [{ type: ObjectId, ref: 'Problem' }],  // reference core
  startTime: Date,
  endTime: Date,
});

// contests/models/ContestSubmission.js
const ContestSubmissionSchema = new mongoose.Schema({
  submission: { type: ObjectId, ref: 'Submission' }, // wrap core submission
  contest:    { type: ObjectId, ref: 'Contest' },
  penalty:    Number,
  rank:       Number,
});
```

### Extension Points Built Into Core

| Field | Model | Purpose |
|-------|-------|---------|
| `sourceType` | Submission | `'practice'` / `'contest'` / `'interview'` / `'challenge'` |
| `sourceId` | Submission | Contest/Interview session ID |
| `companies` | Problem | Company tags (used by AI Interview for targeted questions) |
| `isPremium` | Problem | Subscription gating |
| `role` enum | User | Extend to `'company_recruiter'`, etc. |
| `credits` | User | Required field for interview credit system |

> **Important:** The `credits` field must exist on your `User` model. If it doesn't, add `credits: { type: Number, default: 0 }` to `User.js`.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Collections | PascalCase model → plural snake_case | `User` → `users` |
| Fields | camelCase | `totalSolved`, `createdAt` |
| Routes | kebab-case | `/api/user-problem-stats` |
| Files | PascalCase for models, camelCase for controllers | `User.js`, `userController.js` |
| Env vars | SCREAMING_SNAKE_CASE | `JWT_SECRET`, `ANTHROPIC_API_KEY` |

---

## Scalability Checklist

- [x] Connection pool (`maxPoolSize: 50`)
- [x] Paginated queries (`mongoose-paginate-v2`)
- [x] Stored aggregates (no `COUNT(*)` on hot paths)
- [x] Compound indexes on every join-pattern query
- [x] Text indexes for problem search
- [x] Separate `TestCase` collection (security + scale)
- [x] `UserProblemStats` bridge (O(1) solve checks)
- [x] Rate limiting (auth: 20/15min, api: 500/15min)
- [x] Helmet + CORS security headers
- [x] Append-only submissions (archive-friendly)
- [x] BullMQ + Redis for async AI processing
- [x] Atomic credit transactions (MongoDB sessions)
- [x] Idempotency keys on interview start + credit ops
- [x] Zod validation on all AI responses
- [ ] Redis cache for leaderboard (next step)
- [ ] Read replica for analytics queries
- [ ] Submission archival job (> 1 year → cold storage)

---

## Dependencies

```bash
# Core (existing)
express mongoose jsonwebtoken bcryptjs helmet cors express-rate-limit

# AI Interview (new — install these)
@anthropic-ai/sdk   # Claude API client
bullmq              # Redis-backed job queue
zod                 # AI response validation
express-async-errors # Async error propagation
```

```bash
npm install @anthropic-ai/sdk bullmq zod express-async-errors
```

Redis must be running locally or via a managed service (Upstash, Redis Cloud) for BullMQ to operate. The worker process (`node src/jobs/queue.worker.js`) must be running alongside the API server for AI jobs to be processed.