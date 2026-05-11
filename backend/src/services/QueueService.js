'use strict';

/**
 * QueueService — wraps BullMQ for async AI analysis jobs.
 * Degrades gracefully when Redis is not available (development / no-Redis setups).
 * In that case, all queue operations are no-ops and log a warning.
 */

let Queue;
let bullmqAvailable = false;

try {
  ({ Queue } = require('bullmq'));
  bullmqAvailable = true;
} catch {
  // bullmq or Redis not installed / not reachable — safe to continue without queues
}

const redisConnection = {
  host:     process.env.REDIS_HOST     || 'localhost',
  port:     parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
};

const AI_ANALYSIS_QUEUE = 'ai-analysis';
let aiAnalysisQueue = null;

function getAIAnalysisQueue() {
  if (!bullmqAvailable) return null;
  if (!aiAnalysisQueue) {
    try {
      aiAnalysisQueue = new Queue(AI_ANALYSIS_QUEUE, {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      });
    } catch {
      aiAnalysisQueue = null;
    }
  }
  return aiAnalysisQueue;
}

class QueueService {
  /**
   * Add an AI analysis job.
   * Returns null silently when Redis/BullMQ is unavailable.
   */
  static async addAIAnalysisJob(data, opts = {}) {
    const queue = getAIAnalysisQueue();
    if (!queue) {
      console.warn('[QueueService] Redis/BullMQ unavailable — running AI job synchronously instead:', data);
      const AIService = require('./AIService');
      const jobName = data.type || 'analyze_session';
      
      // Run in background without blocking the HTTP response
      setImmediate(async () => {
        try {
          if (jobName === 'analyze_session') {
            await AIService.analyzeAndGenerateQuestions(data.sessionId);
          } else if (jobName === 'evaluate_answer') {
            await AIService.evaluateAnswer(data.sessionId, data.questionId);
          } else if (jobName === 'generate_adaptive') {
            await AIService.generateAdaptiveQuestion(data.sessionId, data.questionId);
          } else if (jobName === 'final_report') {
            await AIService.generateFinalReport(data.sessionId);
          }
        } catch (err) {
          console.error('[QueueService Sync Fallback] Error:', err);
        }
      });
      return { id: 'sync-' + Date.now(), progress: 0 };
    }
    try {
      const jobName = data.type || 'analyze_session';
      console.log('🔥 ADDING AI JOB:', data);
      const job = await queue.add(jobName, data, {
        priority: opts.priority || 0,
        ...opts,
      });
      return job;
    } catch (err) {
      console.warn('[QueueService] Failed to add job:', err.message);
      return null;
    }
  }

  static async getJobStatus(jobId) {
    const queue = getAIAnalysisQueue();
    if (!queue) return { status: 'unavailable' };
    try {
      const job = await queue.getJob(jobId);
      if (!job) return { status: 'not_found' };
      const state = await job.getState();
      return { status: state, progress: job.progress };
    } catch {
      return { status: 'unknown' };
    }
  }

  static async isHealthy() {
    if (!bullmqAvailable) return false;
    const queue = getAIAnalysisQueue();
    if (!queue) return false;
    try {
      await queue.client;
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = {
  QueueService,
  AI_ANALYSIS_QUEUE,
  redisConnection,
};
