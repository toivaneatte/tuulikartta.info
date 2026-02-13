const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.on('error', err => {
  console.warn('Redis unavailable, continuing without cache');
});

(async () => {
  try {
    await redisClient.connect();
    console.log('Redis connected');
  } catch (err) {
    console.warn('Redis connection failed');
  }
})();

module.exports = redisClient;
