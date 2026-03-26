// ============================================================
// Rexermi ERP v2.0 — In-Memory Cache Service
// Optimized for 24GB RAM — aggressive pre-warming
// ============================================================

import NodeCache from 'node-cache';
import { ICacheService, CacheStats, ILogger } from '../core/interfaces';
import { AppConfig } from '../core/config';

export class MemoryCacheService implements ICacheService {
    private cache: NodeCache;
    private logger: ILogger;
    private config: AppConfig;
    private hits: number = 0;
    private misses: number = 0;

    constructor(config: AppConfig, logger: ILogger) {
        this.config = config;
        this.logger = logger;

        this.cache = new NodeCache({
            stdTTL: config.cache.stdTTLSeconds,
            checkperiod: config.cache.checkPeriodSeconds,
            maxKeys: config.cache.maxKeys,
            useClones: false, // Performance: return references, not clones
            deleteOnExpire: true,
        });

        // Log cache events
        this.cache.on('expired', (key) => {
            this.logger.debug(`Cache key expired: ${key}`);
        });

        this.logger.info('Memory cache initialized', {
            maxKeys: config.cache.maxKeys,
            ttl: config.cache.stdTTLSeconds,
            maxMemoryMB: config.cache.maxMemoryMB,
        });
    }

    get<T>(key: string): T | undefined {
        const value = this.cache.get<T>(key);
        if (value !== undefined) {
            this.hits++;
            return value;
        }
        this.misses++;
        return undefined;
    }

    set<T>(key: string, value: T, ttlSeconds?: number): void {
        if (ttlSeconds !== undefined) {
            this.cache.set(key, value, ttlSeconds);
        } else {
            this.cache.set(key, value);
        }
    }

    del(key: string): void {
        this.cache.del(key);
    }

    flush(): void {
        this.cache.flushAll();
        this.hits = 0;
        this.misses = 0;
        this.logger.info('Cache flushed');
    }

    getStats(): CacheStats {
        const stats = this.cache.getStats();
        const memUsage = process.memoryUsage();

        return {
            hits: this.hits,
            misses: this.misses,
            keys: this.cache.keys().length,
            memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        };
    }

    /**
     * Pre-warm the cache with bulk data from a database table.
     * Perfect for heavy accounting/inventory tables.
     */
    preWarm(tableName: string, data: unknown[]): void {
        const startTime = Date.now();

        // Store full table
        this.cache.set(`table:${tableName}`, data, 0); // TTL 0 = no expiration

        // Index by ID if rows have an "id" field
        for (const row of data) {
            const record = row as Record<string, unknown>;
            if (record.id) {
                this.cache.set(`${tableName}:${record.id}`, row, 0);
            }
        }

        const elapsed = Date.now() - startTime;
        this.logger.info(`Cache pre-warmed: ${tableName}`, {
            rows: data.length,
            timeMs: elapsed,
        });
    }

    /**
     * Get an entire pre-warmed table
     */
    getTable<T>(tableName: string): T[] | undefined {
        return this.get<T[]>(`table:${tableName}`);
    }

    /**
     * Get a specific record by table and ID
     */
    getRecord<T>(tableName: string, id: string): T | undefined {
        return this.get<T>(`${tableName}:${id}`);
    }

    /**
     * Invalidate all cache entries for a table  
     * (call after write operations)
     */
    invalidateTable(tableName: string): void {
        const keys = this.cache.keys().filter(k => k.startsWith(`${tableName}:`));
        this.cache.del([`table:${tableName}`, ...keys]);
        this.logger.debug(`Cache invalidated for table: ${tableName}`, { keysRemoved: keys.length + 1 });
    }
}
