'use strict';

/**
 * Unit tests for QueueService.
 * BullMQ and Redis are fully mocked — no real Redis needed.
 */

jest.mock('bullmq', () => {
  const mockAdd            = jest.fn();
  const mockClose          = jest.fn().mockResolvedValue(undefined);
  const mockGetJob         = jest.fn();
  const mockWaitUntilReady = jest.fn().mockResolvedValue(undefined);

  const MockQueue = jest.fn().mockImplementation(() => ({
    add:            mockAdd,
    close:          mockClose,
    getJob:         mockGetJob,
    waitUntilReady: mockWaitUntilReady,
  }));

  return { Queue: MockQueue, Worker: jest.fn() };
}, { virtual: true });

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  console.warn.mockRestore();
  console.error.mockRestore();
});

describe('QueueService.isHealthy', () => {
  it('returns an object with { healthy, mode, redisHost, redisPort }', async () => {
    const { QueueService } = require('../src/services/QueueService');
    const result = await QueueService.isHealthy();
    expect(result).toHaveProperty('healthy');
    expect(result).toHaveProperty('mode');
    expect(result).toHaveProperty('redisHost');
    expect(result).toHaveProperty('redisPort');
    expect(typeof result.healthy).toBe('boolean');
  });

  it('mode is one of the expected values', async () => {
    const { QueueService } = require('../src/services/QueueService');
    const { mode } = await QueueService.isHealthy();
    expect(['queue', 'sync_fallback', 'unavailable']).toContain(mode);
  });
});

describe('QueueService.getJobStatus', () => {
  it('returns completed for sync- prefixed job IDs without touching Redis', async () => {
    const { QueueService } = require('../src/services/QueueService');
    const result = await QueueService.getJobStatus('sync-1234567890');
    expect(result.status).toBe('completed');
    expect(result.mode).toBe('synchronous');
  });
});

describe('QueueService.addAIAnalysisJob', () => {
  it('always returns an object with an id field (Redis or sync)', async () => {
    jest.mock('../src/services/AIService', () => ({
      analyzeAndGenerateQuestions: jest.fn().mockResolvedValue(undefined),
      evaluateAnswer:              jest.fn().mockResolvedValue(undefined),
      generateAdaptiveQuestion:    jest.fn().mockResolvedValue(undefined),
      generateFinalReport:         jest.fn().mockResolvedValue(undefined),
    }), { virtual: true });

    const { QueueService } = require('../src/services/QueueService');
    const result = await QueueService.addAIAnalysisJob({
      type:      'final_report',
      sessionId: 'test-session-id',
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('id');
  });

  it('does not throw even when the AI job itself throws', async () => {
    jest.mock('../src/services/AIService', () => ({
      generateFinalReport:         jest.fn().mockRejectedValue(new Error('AI exploded')),
      analyzeAndGenerateQuestions: jest.fn(),
      evaluateAnswer:              jest.fn(),
      generateAdaptiveQuestion:    jest.fn(),
    }), { virtual: true });

    const { QueueService } = require('../src/services/QueueService');
    await expect(
      QueueService.addAIAnalysisJob({ type: 'final_report', sessionId: 'boom' })
    ).resolves.toBeDefined();
  });
});