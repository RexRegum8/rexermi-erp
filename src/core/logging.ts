// ============================================================
// Rexermi ERP v2.0 — Centralized Logging Service
// File + Console logging with rotation using Winston
// ============================================================

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { ILogger } from './interfaces';

export class LoggingService implements ILogger {
    private logger: winston.Logger;
    private static instance: LoggingService | null = null;

    constructor(logDir?: string) {
        const logsPath = logDir || path.join(process.cwd(), 'logs');
        
        // Ensure logs directory exists
        if (!fs.existsSync(logsPath)) {
            fs.mkdirSync(logsPath, { recursive: true });
        }

        this.logger = winston.createLogger({
            level: 'debug',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'rexermi-erp' },
            transports: [
                // Console — colorized and readable
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                            return `${timestamp} [${level}] ${message}${metaStr}`;
                        })
                    ),
                }),
                // File — errors only
                new winston.transports.File({
                    filename: path.join(logsPath, 'error.log'),
                    level: 'error',
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5,
                }),
                // File — all levels
                new winston.transports.File({
                    filename: path.join(logsPath, 'combined.log'),
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 7,
                }),
            ],
        });
    }

    static getInstance(logDir?: string): LoggingService {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService(logDir);
        }
        return LoggingService.instance;
    }

    info(message: string, meta?: Record<string, unknown>): void {
        this.logger.info(message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        this.logger.warn(message, meta);
    }

    error(message: string, error?: Error, meta?: Record<string, unknown>): void {
        this.logger.error(message, { error: error?.stack || error?.message, ...meta });
    }

    debug(message: string, meta?: Record<string, unknown>): void {
        this.logger.debug(message, meta);
    }
}
