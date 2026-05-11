const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient;

async function connectRedis() {
  redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB || '0'),
  });

  redisClient.on('error', (err) => logger.error('Redis error:', err));
  redisClient.on('reconnecting', () => logger.warn('Redis reconnecting…'));

  await redisClient.connect();
  logger.info('Redis connected successfully');
  return redisClient;
}

function getRedis() {
  if (!redisClient) throw new Error('Redis not initialised');
  return redisClient;
}

/**
 * Simple cache helpers
 */
async function cacheGet(key) {
  const val = await getRedis().get(key);
  return val ? JSON.parse(val) : null;
}

async function cacheSet(key, value, ttlSeconds = 300) {
  await getRedis().setEx(key, ttlSeconds, JSON.stringify(value));
}

async function cacheDel(key) {
  await getRedis().del(key);
}

module.exports = { connectRedis, getRedis, cacheGet, cacheSet, cacheDel };
