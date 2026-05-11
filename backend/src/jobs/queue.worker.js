require('dotenv').config();
require('../models/Problem');
require('../models/TestCase');
require('../models/Submission');
require('../models/User');
require('../models/InterviewSession');
require('../models/InterviewQuestion');
require('../models/AIResponse');

require('express-async-errors');
const { Worker } = require('bullmq');
const { processAIAnalysisJob } = require('./aiAnalysis.job');
const { AI_ANALYSIS_QUEUE, redisConnection } = require('../services/QueueService');
const InterviewSession = require('../models/InterviewSession');

let worker = null;


function startWorker() {
  if (worker) return worker;

  worker = new Worker(
    AI_ANALYSIS_QUEUE,
    async (job) => {
  console.log('🔥 WORKER RECEIVED JOB');
  console.log(job.data);

  return processAIAnalysisJob(job);
},
    {
      connection: redisConnection,
      concurrency: parseInt(process.env.AI_WORKER_CONCURRENCY || '2', 10),
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed:`, JSON.stringify(result));
  });

  worker.on('failed', async (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);

    // After all retries exhausted, mark session AI as error
    if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
      const { sessionId } = job.data || {};
      if (sessionId) {
        try {
          await InterviewSession.findByIdAndUpdate(sessionId, { aiAnalysisStatus: 'error' });
        } catch (_) {}
      }
    }
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  console.log(`[Worker] AI Analysis worker started. Listening on queue: ${AI_ANALYSIS_QUEUE}`);
  return worker;
}

async function stopWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[Worker] AI Analysis worker stopped.');
  }
}

module.exports = { startWorker, stopWorker };

// Allow running as standalone process: node queue.worker.js
if (require.main === module) {
  const mongoose = require('mongoose');
  require('dotenv').config();

  mongoose
    .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/codeverse')
    .then(() => {
      console.log('[Worker] MongoDB connected');
      startWorker();
    })
    .catch((err) => {
      console.error('[Worker] MongoDB connection failed:', err);
      process.exit(1);
    });

  process.on('SIGTERM', async () => {
    await stopWorker();
    await mongoose.disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await stopWorker();
    await mongoose.disconnect();
    process.exit(0);
  });
}
