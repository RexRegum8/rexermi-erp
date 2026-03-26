// ============================================================
// Rexermi ERP v2.0 — Web Server Module
// Express + Socket.io for real-time notifications
// ============================================================

import express, { Express, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { IPlugin, IServiceContainer, ILogger } from '../core/interfaces';
import { AppConfig } from '../core/config';
import { AuthService, authMiddleware, requireCapability } from '../auth';
import { DatabaseService } from '../data/database';
import { MemoryCacheService } from '../cache/memory-cache';
import { GitHubUpdateService } from '../updater/github-update-service';

export class WebServerPlugin implements IPlugin {
    readonly name = 'WebServer';
    readonly version = '2.0.0';
    readonly requiredCapabilities = ['can_manage_webserver'];

    private app: Express | null = null;
    private server: http.Server | null = null;
    private io: SocketServer | null = null;
    private logger!: ILogger;

    async initialize(container: IServiceContainer): Promise<void> {
        const config = container.resolve<AppConfig>('config');
        const logger = container.resolve<ILogger>('logger');
        const db = container.resolve<DatabaseService>('database');
        const authService = container.resolve<AuthService>('authService');
        const cacheService = container.resolve<MemoryCacheService>('cacheService');
        const updateService = container.resolve<GitHubUpdateService>('updateService');

        this.logger = logger;
        this.app = express();
        
        // Create HTTP server
        this.server = http.createServer(this.app);

        // Initialize Socket.io
        this.io = new SocketServer(this.server, {
            cors: {
                origin: config.server.corsOrigins,
                credentials: true,
            }
        });

        this.io.on('connection', (socket) => {
            logger.debug('New socket connection', { id: socket.id });
            
            socket.on('disconnect', () => {
                logger.debug('Socket disconnected', { id: socket.id });
            });
        });

        // =============================================
        // Middleware Stack
        // =============================================
        this.app.use(helmet({
            contentSecurityPolicy: false,
        }));
        this.app.use(cors({
            origin: config.server.corsOrigins,
            credentials: true,
        }));
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, _res, next) => {
            logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
            next();
        });

        // =============================================
        // Public Routes
        // =============================================
        const publicRouter = Router();

        publicRouter.get('/api/health', (_req, res) => {
            const stats = cacheService.getStats();
            res.json({
                status: 'ok',
                version: config.app.version,
                uptime: process.uptime(),
                memory: stats.memoryUsageMB,
                cache: stats,
            });
        });

        publicRouter.post('/api/auth/login', async (req, res) => {
            const { username, password } = req.body;
            if (!username || !password) {
                res.status(400).json({ error: 'Username y password son requeridos' });
                return;
            }
            const result = await authService.login(username, password);
            if (result.success) {
                this.notify('auth:login', { username: result.user?.username });
                res.json(result);
            } else {
                res.status(401).json(result);
            }
        });

        this.app.use(publicRouter);

        // =============================================
        // Protected Routes
        // =============================================
        const protectedRouter = Router();
        protectedRouter.use(authMiddleware(authService));

        protectedRouter.get('/api/me', (req, res) => {
            const user = db.getUserById(req.user!.userId);
            if (!user) {
                res.status(404).json({ error: 'Usuario no encontrado' });
                return;
            }
            res.json({
                id: user.id,
                username: user.username,
                email: user.email,
                roles: db.getUserRoles(user.id).map(r => r.name),
                capabilities: req.user!.capabilities,
                lastLogin: user.last_login,
            });
        });

        protectedRouter.get('/api/users', requireCapability('can_manage_users'), (_req, res) => {
            const users = db.queryAll(`
                SELECT id, username, email, is_active, created_at, last_login FROM users
            `);
            res.json(users);
        });

        protectedRouter.post('/api/users', requireCapability('can_manage_users'), async (req, res) => {
            try {
                const { username, email, password, role } = req.body;
                if (!username || !password) {
                    res.status(400).json({ error: 'Username y password son requeridos' });
                    return;
                }
                const hash = await authService.hashPassword(password);
                const userId = db.createUser(username, email || null, hash);
                if (role) db.assignRoleToUser(userId, role);
                
                logger.info('User created', { username, by: req.user!.username });
                db.logAudit(req.user!.userId, 'USER_CREATE', 'System', `Created user: ${username}`);
                this.notify('system:user_created', { username });

                res.status(201).json({ id: userId, username, email });
            } catch (err: any) {
                res.status(500).json({ error: err.message || 'Error creando usuario' });
            }
        });

        protectedRouter.get('/api/system/audit', requireCapability('can_view_logs'), (req, res) => {
            const limit = parseInt(req.query.limit as string) || 100;
            const offset = parseInt(req.query.offset as string) || 0;
            res.json(db.getAuditLogs(limit, offset));
        });

        protectedRouter.get('/api/roles', requireCapability('can_manage_roles'), (_req, res) => {
            res.json(db.getAllRoles().map(role => ({
                ...role,
                capabilities: db.getRoleCapabilities(role.id),
            })));
        });

        protectedRouter.post('/api/roles', requireCapability('can_manage_roles'), (req, res) => {
            try {
                const { name, description, capabilities } = req.body;
                const roleId = db.createRole(name, description || '', capabilities || []);
                db.logAudit(req.user!.userId, 'ROLE_CREATE', 'System', `Created role: ${name}`);
                this.notify('system:role_created', { name });
                res.status(201).json({ id: roleId, name });
            } catch (err: any) {
                res.status(500).json({ error: 'Error creando rol' });
            }
        });

        protectedRouter.get('/api/capabilities', requireCapability('can_manage_roles'), (_req, res) => {
            res.json(db.getAllCapabilities());
        });

        protectedRouter.get('/api/system/info', requireCapability('system_admin'), (_req, res) => {
            res.json({
                app: config.app,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cache: cacheService.getStats(),
            });
        });

        protectedRouter.post('/api/cache/flush', requireCapability('system_admin'), (req, res) => {
            cacheService.flush();
            db.logAudit(req.user!.userId, 'CACHE_FLUSH', 'System', 'Cache flushed manually');
            res.json({ success: true });
        });

        protectedRouter.post('/api/system/update/check', requireCapability('system_admin'), async (req, res) => {
            try {
                const update = await updateService.checkForUpdates();
                if (update) {
                    this.notify('system:update_available', update);
                    res.json({ updateAvailable: true, info: update });
                } else {
                    res.json({ updateAvailable: false });
                }
            } catch (err: any) {
                res.status(500).json({ error: 'Error comprobando actualizaciones' });
            }
        });

        protectedRouter.post('/api/system/update/download', requireCapability('system_admin'), async (req, res) => {
            try {
                const update = await updateService.checkForUpdates();
                if (!update) {
                    res.status(404).json({ error: 'No hay actualizaciones disponibles' });
                    return;
                }
                
                db.logAudit(req.user!.userId, 'UPDATE_DOWNLOAD', 'System', `Downloading v${update.latestVersion}`);
                
                // Fire and forget download for now or handle progress via sockets
                updateService.downloadUpdate(update, (pct) => {
                    this.notify('system:update_progress', { pct });
                }).then((path) => {
                    this.notify('system:update_ready', { path });
                }).catch(err => {
                    this.logger.error('Update download failed', err);
                });

                res.json({ success: true, message: 'Descarga iniciada' });
            } catch (err: any) {
                res.status(500).json({ error: 'Error iniciando descarga' });
            }
        });

        this.app.use(protectedRouter);

        // Error Handler
        this.app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            logger.error('Unhandled server error', err);
            res.status(500).json({ error: 'Error interno del servidor' });
        });

        return new Promise<void>((resolve, reject) => {
            this.server!.listen(config.server.port, config.server.host, () => {
                logger.info(`🌐 Web server (with WebSockets) running at http://${config.server.host}:${config.server.port}`);
                resolve();
            });

            this.server!.on('error', (err) => {
                logger.error('Web server failed to start', err);
                reject(err);
            });
        });
    }

    /**
     * Send a real-time notification to all connected clients
     */
    notify(event: string, data: any): void {
        if (this.io) {
            this.io.emit(event, data);
            this.logger.debug(`Real-time notification sent: ${event}`, data);
        }
    }

    async shutdown(): Promise<void> {
        if (this.server) {
            return new Promise((resolve) => {
                this.server!.close(() => {
                    this.logger.info('Web server stopped');
                    resolve();
                });
            });
        }
    }

    getApp(): Express | null {
        return this.app;
    }
}
