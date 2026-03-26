// ============================================================
// Rexermi ERP v2.0 — Capability Guard Middleware
// Express middleware for capability-based route protection
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth-service';

/**
 * Extend Express Request to include authenticated user info
 */
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                username: string;
                capabilities: string[];
            };
        }
    }
}

/**
 * Middleware: Extract and verify JWT from Authorization header
 */
export function authMiddleware(authService: AuthService) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Token de autenticación requerido' });
            return;
        }

        const token = authHeader.substring(7);
        const payload = authService.verifyToken(token);

        if (!payload) {
            res.status(401).json({ error: 'Token inválido o expirado' });
            return;
        }

        req.user = {
            userId: payload.userId,
            username: payload.username,
            capabilities: payload.capabilities,
        };

        next();
    };
}

/**
 * Middleware factory: Require specific capability(ies)
 * Usage: router.get('/accounting', requireCapability('can_view_accounting'), handler)
 */
export function requireCapability(...capabilities: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }

        // system_admin bypasses all checks
        if (req.user.capabilities.includes('system_admin')) {
            next();
            return;
        }

        const hasAll = capabilities.every(cap => req.user!.capabilities.includes(cap));

        if (!hasAll) {
            res.status(403).json({
                error: 'Permisos insuficientes',
                required: capabilities,
                current: req.user.capabilities,
            });
            return;
        }

        next();
    };
}

/**
 * Middleware factory: Require ANY of the specified capabilities
 */
export function requireAnyCapability(...capabilities: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }

        if (req.user.capabilities.includes('system_admin')) {
            next();
            return;
        }

        const hasAny = capabilities.some(cap => req.user!.capabilities.includes(cap));

        if (!hasAny) {
            res.status(403).json({
                error: 'Permisos insuficientes (se requiere al menos uno)',
                required: capabilities,
                current: req.user.capabilities,
            });
            return;
        }

        next();
    };
}
