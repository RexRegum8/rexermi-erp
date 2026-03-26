// ============================================================
// Rexermi ERP v2.0 — Authentication Service
// BCrypt hashing + JWT tokens + Capability-based authorization
// ============================================================

import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { IAuthService, AuthResult, TokenPayload, ILogger } from '../core/interfaces';
import { AppConfig } from '../core/config';
import { DatabaseService } from '../data/database';

export class AuthService implements IAuthService {
    private db: DatabaseService;
    private config: AppConfig;
    private logger: ILogger;
    // In-memory capability cache per user — avoids DB hits on every request
    private capabilityCache: Map<string, { capabilities: string[]; expiry: number }> = new Map();

    constructor(db: DatabaseService, config: AppConfig, logger: ILogger) {
        this.db = db;
        this.config = config;
        this.logger = logger;
    }

    async login(username: string, password: string): Promise<AuthResult> {
        try {
            const user = this.db.getUserByUsername(username);

            if (!user) {
                this.logger.warn('Login failed: user not found', { username });
                return { success: false, error: 'Credenciales inválidas' };
            }

            if (!user.is_active) {
                this.logger.warn('Login failed: user inactive', { username });
                return { success: false, error: 'Cuenta desactivada. Contacte al administrador.' };
            }

            const passwordValid = await this.verifyPassword(password, user.password_hash);
            if (!passwordValid) {
                this.logger.warn('Login failed: invalid password', { username });
                this.db.logAudit(user.id, 'LOGIN_FAILURE', 'Auth', 'Invalid password attempt');
                return { success: false, error: 'Credenciales inválidas' };
            }

            // Get user capabilities
            const capabilities = this.getUserCapabilities(user.id);

            // Generate JWT
            const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
                userId: user.id,
                username: user.username,
                capabilities,
            };

            const signOptions: SignOptions = {
                expiresIn: this.config.auth.jwtExpiresIn as any,
            };
            const token = jwt.sign(payload, this.config.auth.jwtSecret, signOptions);

            // Update last login
            this.db.updateLastLogin(user.id);

            // Store session
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
            this.db.createSession(user.id, token, expiresAt);

            // Audit log
            this.db.logAudit(user.id, 'LOGIN_SUCCESS', 'Auth', 'User logged in successfully');

            this.logger.info('Login successful', { username, capabilities: capabilities.length });

            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email || '',
                    capabilities,
                },
            };
        } catch (err) {
            this.logger.error('Login error', err as Error, { username });
            return { success: false, error: 'Error interno del servidor' };
        }
    }

    verifyToken(token: string): TokenPayload | null {
        try {
            const decoded = jwt.verify(token, this.config.auth.jwtSecret) as TokenPayload;
            return decoded;
        } catch {
            return null;
        }
    }

    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.config.auth.bcryptRounds);
    }

    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    userHasCapability(userId: string, capability: string): boolean {
        const capabilities = this.getUserCapabilities(userId);
        // system_admin grants ALL capabilities
        if (capabilities.includes('system_admin')) return true;
        return capabilities.includes(capability);
    }

    getUserCapabilities(userId: string): string[] {
        // Check cache first (5 minute TTL)
        const cached = this.capabilityCache.get(userId);
        if (cached && cached.expiry > Date.now()) {
            return cached.capabilities;
        }

        const capabilities = this.db.getUserCapabilities(userId);
        
        // Cache for 5 minutes
        this.capabilityCache.set(userId, {
            capabilities,
            expiry: Date.now() + 5 * 60 * 1000,
        });

        return capabilities;
    }

    /**
     * Invalidate capability cache for a user (call after role changes)
     */
    invalidateUserCache(userId: string): void {
        this.capabilityCache.delete(userId);
    }

    /**
     * Clean up expired sessions periodically
     */
    cleanupSessions(): number {
        const deleted = this.db.deleteExpiredSessions();
        if (deleted > 0) {
            this.logger.info(`Cleaned up ${deleted} expired sessions`);
            this.db.logAudit(null, 'SESSION_CLEANUP', 'System', `Cleaned up ${deleted} sessions`);
        }
        return deleted;
    }
}
