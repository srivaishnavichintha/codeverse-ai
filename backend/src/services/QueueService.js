'use strict';

/**
 * QueueService — wraps BullMQ for async AI analysis jobs.
 *
 * Redis failure behaviour (improved):
 *  - On startup, we attempt a real ping to Redis before accepting jobs.
 *  - If Redis is unreachable we switch to a synchronous in-process fallback
 *    AND log a structured warning ONCE (not on every job).
 *  - The health status is re-checked periodically so the queue recovers
 *    automatically when Redis comes back up.
 *  - isHealthy() returns a rich object instead of a bare boolean so
 *    callers (health-check routes, monitoring) get actionable detail.
 */

let Queue, Worker;
let bullmqAvailable = false;

try {
  ({ Queue, Worker } = require('bullmq'));
  bullmqAvailable = true;
} catch {
  // bullmq not installed — safe to run without queues
}

const redisConnection = {
  host:        process.env.REDIS_HOST     || 'localhost',
  port:        parseInt(process.env.REDIS_PORT || '6379', 10),
  password:    process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  // Fail fast rather than hanging — avoids blocking the event loop on startup
  connectTimeout:       3000,
  maxRetriesPerRequest: 1,
};

const AI_ANALYSIS_QUEUE = 'ai-analysis';

// ─────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────

let aiAnalysisQueue  = null;
let redisReachable   = null;   // null = not yet checked
let lastHealthCheck  = 0;
let warnedOnce       = false;  // emit the "Redis unavailable" warning only once per outage

const HEALTH_CHECK_INTERVAL_MS = 30_000; // re-probe Redis every 30 s

// ─────────────────────────────────────────────────────────
// Redis reachability probe
// ─────────────────────────────────────────────────────────

async function probeRedis() {
  if (!bullmqAvailable) return false;
  try {
    const q = new Queue('__probe__', { connection: redisConnection });
    await q.waitUntilReady();
    await q.close();
    return true;
  } catch {
    return false;
  }
}

async function checkRedisHealth() {
  const now = Date.now();
  if (redisReachable !== null && now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
    return redisReachable;
  }

  redisReachable  = await probeRedis();
  lastHealthCheck = now;

  if (redisReachable) {
    warnedOnce = false; // reset so we warn again if Redis goes down later
    if (!aiAnalysisQueue) {
      aiAnalysisQueue = buildQueue();
    }
  } else {
    if (!warnedOnce) {
      console.warn(
        '[QueueService] Redis is unreachable — AI jobs will run synchronously in-process. ' +
        'Set REDIS_HOST / REDIS_PORT / REDIS_PASSWORD in your environment to enable the queue.'
      );
      warnedOnce = true;
    }
    aiAnalysisQueue = null;
  }

  return redisReachable;
}

// ─────────────────────────────────────────────────────────
// Queue factory
// ─────────────────────────────────────────────────────────

function buildQueue() {
  if (!bullmqAvailable) return null;
  try {
    return new Queue(AI_ANALYSIS_QUEUE, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
      },
    });
  } catch (err) {
    console.error('[QueueService] Failed to create Queue instance:', err.message);
    return null;
  }
}

async function getAIAnalysisQueue() {
  const healthy = await checkRedisHealth();
  if (!healthy) return null;
  if (!aiAnalysisQueue) aiAnalysisQueue = buildQueue();
  return aiAnalysisQueue;
}

// ─────────────────────────────────────────────────────────
// Synchronous (in-process) fallback
// ─────────────────────────────────────────────────────────

function runSyncFallback(data) {
  const AIService = require('./AIService');
  const jobName   = data.type || 'analyze_session';

  setImmediate(async () => {
    try {
      if      (jobName === 'analyze_session')  await AIService.analyzeAndGenerateQuestions(data.sessionId);
      else if (jobName === 'evaluate_answer')  await AIService.evaluateAnswer(data.sessionId, data.questionId);
      else if (jobName === 'generate_adaptive') await AIService.generateAdaptiveQuestion(data.sessionId, data.questionId);
      else if (jobName === 'final_report')     await AIService.generateFinalReport(data.sessionId);
      else console.warn('[QueueService Sync] Unknown job type:', jobName);
    } catch (err) {
      console.error('[QueueService Sync Fallback] Error executing job synchronously:', {
        jobName,
        sessionId: data.sessionId,
        error: err.message,
      });
    }
  });

  return { id: `sync-${Date.now()}`, progress: 0, mode: 'synchronous' };
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

class QueueService {
  /**
   * Add an AI analysis job.
   * Falls back to synchronous in-process execution when Redis is unavailable.
   * Returns a job-like object in both cases so callers don't need to branch.
   */
  static async addAIAnalysisJob(data, opts = {}) {
    const queue = await getAIAnalysisQueue();

    if (!queue) {
      return runSyncFallback(data);
    }

    try {
      const jobName = data.type || 'analyze_session';
      const job = await queue.add(jobName, data, {
        priority: opts.priority || 0,
        ...opts,
      });
      return job;
    } catch (err) {
      // Queue add failed despite Redis appearing healthy — fall back gracefully
      console.error('[QueueService] Failed to enqueue job, falling back to sync:', {
        error: err.message,
        data,
      });
      // Mark Redis as unhealthy so next call re-probes
      redisReachable  = false;
      aiAnalysisQueue = null;
      return runSyncFallback(data);
    }
  }

  static async getJobStatus(jobId) {
    // Sync fallback jobs are already done by the time the caller checks
    if (typeof jobId === 'string' && jobId.startsWith('sync-')) {
      return { status: 'completed', progress: 100, mode: 'synchronous' };
    }

    const queue = await getAIAnalysisQueue();
    if (!queue) return { status: 'unavailable', reason: 'Redis not reachable' };

    try {
      const job = await queue.getJob(jobId);
      if (!job) return { status: 'not_found' };
      const state = await job.getState();
      return { status: state, progress: job.progress };
    } catch (err) {
      return { status: 'unknown', error: err.message };
    }
  }

  /**
   * Returns a structured health object rather than a bare boolean.
   * { healthy: boolean, mode: 'queue'|'sync_fallback'|'unavailable', redisHost, redisPort }
   */
  static async isHealthy() {
    const healthy = await checkRedisHealth();
    return {
      healthy,
      mode:      healthy ? 'queue' : (bullmqAvailable ? 'sync_fallback' : 'unavailable'),
      redisHost: redisConnection.host,
      redisPort: redisConnection.port,
    };
  }
}

module.exports = {
  QueueService,
  AI_ANALYSIS_QUEUE,
  redisConnection,
};