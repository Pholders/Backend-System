const redis = require('redis');

/**
 * Redis Cache Service
 * Handles caching of frequently accessed data
 */

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      this.client = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      console.log('⚠️  Continuing without Redis cache');
    }
  }

  /**
   * Set cache with TTL (time to live)
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default 1 hour)
   */
  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return;

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('❌ Cache set error:', error);
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or null
   */
  async get(key) {
    if (!this.isConnected) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cache key
   * @param {string} key - Cache key
   */
  async del(key) {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.error('❌ Cache delete error:', error);
    }
  }

  /**
   * Delete multiple cache keys by pattern
   * @param {string} pattern - Pattern to match (e.g., 'user:*')
   */
  async delPattern(pattern) {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('❌ Cache pattern delete error:', error);
    }
  }

  /**
   * Clear all cache
   */
  async flush() {
    if (!this.isConnected) return;

    try {
      await this.client.flushDb();
      console.log('✅ Cache flushed');
    } catch (error) {
      console.error('❌ Cache flush error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async stats() {
    if (!this.isConnected) return { connected: false };

    try {
      const info = await this.client.info('memory');
      return { connected: true, info };
    } catch (error) {
      console.error('❌ Cache stats error:', error);
      return { connected: false };
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable() {
    return this.isConnected;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        console.log('✅ Redis disconnected');
      } catch (error) {
        console.error('❌ Redis disconnect error:', error);
      }
    }
  }
}

// Export singleton instance
module.exports = new CacheService();
