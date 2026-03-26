// ============================================================
// Rexermi ERP v2.0 — Host Entry Point (Composition Root)
// Orchestrates all modules: Bootstrap → Auth → Cache → WebServer → Tunnel → Updater
// ============================================================

import { ServiceContainer } from '../core/container';
import { LoggingService } from '../core/logging';
import { loadConfig, AppConfig } from '../core/config';
import { PluginLoader } from '../core/plugin-loader';
import { DatabaseService } from '../data/database';
import { AuthService } from '../auth/auth-service';
import { MemoryCacheService } from '../cache/memory-cache';
import { BootstrapService } from '../bootstrapper/bootstrap-service';
import { GitHubUpdateService } from '../updater/github-update-service';
import { CloudflareTunnelService } from '../tunnel/cloudflare-tunnel-service';
import { WebServerPlugin } from '../webserver/web-server-plugin';
import { InstallationStatus } from '../core/interfaces';

class RexermiApp {
    private container: ServiceContainer;
    private logger: LoggingService;
    private config: AppConfig;
    private pluginLoader: PluginLoader;
    private isShuttingDown: boolean = false;

    constructor() {
        this.config = loadConfig();
        this.logger = LoggingService.getInstance(this.config.logging.dir);
        this.container = new ServiceContainer();
        this.pluginLoader = new PluginLoader(this.logger);
    }

    async start(): Promise<void> {
        console.log('');
        console.log('╔═══════════════════════════════════════════════════╗');
        console.log('║         🏢  REXERMI ERP v2.0                     ║');
        console.log('║         Sistema Empresarial Modular               ║');
        console.log('╚═══════════════════════════════════════════════════╝');
        console.log('');

        this.logger.info('Starting Rexermi ERP v2.0...');

        try {
            // =============================================
            // Phase 1: Core Services Registration
            // =============================================
            this.logger.info('Phase 1: Initializing core services...');

            const db = new DatabaseService(this.config, this.logger);
            await db.init(); // Initialize sql.js WASM engine
            const authService = new AuthService(db, this.config, this.logger);
            const cacheService = new MemoryCacheService(this.config, this.logger);

            // Register all services in the DI container
            this.container.register('config', this.config);
            this.container.register('logger', this.logger);
            this.container.register('database', db);
            this.container.register('authService', authService);
            this.container.register('cacheService', cacheService);

            this.logger.info('Core services initialized ✓');

            // =============================================
            // Phase 2: Bootstrapper
            // =============================================
            this.logger.info('Phase 2: Running bootstrapper...');

            const bootstrapper = new BootstrapService(
                db, authService, cacheService, this.config, this.logger
            );

            const installStatus = await bootstrapper.detectInstallation();

            switch (installStatus) {
                case InstallationStatus.FRESH_INSTALL:
                    await bootstrapper.runFirstTimeSetup();
                    // Auto-select max performance for first run
                    await bootstrapper.executeChoice(
                        (await bootstrapper.showStartupMenu())
                    );
                    break;

                case InstallationStatus.EXISTING_INSTALL:
                    const choice = await bootstrapper.showStartupMenu();
                    await bootstrapper.executeChoice(choice);
                    break;

                case InstallationStatus.CORRUPTED:
                    this.logger.error('Database is corrupted! Running fresh setup...');
                    db.initializeSchema();
                    const hash = await authService.hashPassword('admin123');
                    db.seedDefaults(hash);
                    break;
            }

            this.logger.info('Bootstrapper complete ✓');

            // =============================================
            // Phase 3: Start Web Server (on async thread)
            // =============================================
            this.logger.info('Phase 3: Starting web server...');

            const webServer = new WebServerPlugin();
            await webServer.initialize(this.container);
            this.container.register('webServer', webServer);

            this.logger.info('Web server started ✓');

            // =============================================
            // Phase 4: Load External Plugins
            // =============================================
            this.logger.info('Phase 4: Loading plugins...');

            const plugins = await this.pluginLoader.discoverPlugins(this.config.plugins.dir);
            if (plugins.length > 0) {
                await this.pluginLoader.initializeAll(this.container);
                this.logger.info(`Plugins loaded: ${plugins.length} ✓`);
            } else {
                this.logger.info('No external plugins found');
            }

            // =============================================
            // Phase 5: Cloudflare Tunnel
            // =============================================
            this.logger.info('Phase 5: Cloudflare tunnel...');

            const tunnel = new CloudflareTunnelService(this.config, this.logger);
            this.container.register('tunnel', tunnel);

            if (this.config.cloudflare.tunnelToken) {
                await tunnel.start(this.config.server.port);
            } else {
                this.logger.info('Cloudflare tunnel skipped (no token configured)');
            }

            // =============================================
            // Phase 6: GitHub Update Check
            // =============================================
            this.logger.info('Phase 6: Checking for updates...');

            const updater = new GitHubUpdateService(this.config, this.logger);
            this.container.register('updater', updater);

            // Non-blocking update check
            updater.checkForUpdates().then(updateInfo => {
                if (updateInfo) {
                    this.logger.info('═══════════════════════════════════════════');
                    this.logger.info(`🆕 ACTUALIZACIÓN DISPONIBLE: v${updateInfo.latestVersion}`);
                    this.logger.info(`   ${updateInfo.releaseNotes.substring(0, 200)}`);
                    this.logger.info('═══════════════════════════════════════════');
                }
            }).catch(() => { /* silent fail */ });

            // Start periodic update checks
            updater.startPeriodicChecks((update) => {
                this.logger.info(`🆕 Nueva versión disponible: v${update.latestVersion}`);
            });

            // =============================================
            // Phase 7: Periodic Maintenance
            // =============================================
            // Clean expired sessions every 15 minutes
            setInterval(() => {
                authService.cleanupSessions();
            }, 15 * 60 * 1000);

            // =============================================
            // Startup Complete
            // =============================================
            console.log('');
            console.log('╔═══════════════════════════════════════════════════╗');
            console.log('║  ✅  REXERMI ERP v2.0 — Sistema Listo            ║');
            console.log(`║  🌐  http://localhost:${this.config.server.port}                       ║`);
            if (tunnel.isRunning()) {
                console.log(`║  ☁️   ${tunnel.getPublicUrl()}     ║`);
            }
            console.log('║  👤  admin / admin123 (¡Cambiar contraseña!)     ║');
            console.log('╚═══════════════════════════════════════════════════╝');
            console.log('');

            this.logger.info('🚀 Rexermi ERP v2.0 is ready!');

            // =============================================
            // Graceful Shutdown Handlers
            // =============================================
            this.setupShutdownHandlers(db, tunnel, updater);

        } catch (err) {
            this.logger.error('Fatal error during startup', err as Error);
            process.exit(1);
        }
    }

    private setupShutdownHandlers(
        db: DatabaseService,
        tunnel: CloudflareTunnelService,
        updater: GitHubUpdateService
    ): void {
        const shutdown = async (signal: string) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            this.logger.info(`\n${signal} received. Shutting down gracefully...`);

            try {
                // Stop update checks
                updater.stopPeriodicChecks();

                // Stop tunnel
                await tunnel.stop();

                // Shutdown plugins
                await this.pluginLoader.shutdownAll();

                // Close database
                db.close();

                this.logger.info('Shutdown complete. Goodbye! 👋');
                process.exit(0);
            } catch (err) {
                this.logger.error('Error during shutdown', err as Error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        // Windows-specific: handle Ctrl+C
        if (process.platform === 'win32') {
            const rl = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            rl.on('close', () => shutdown('CLOSE'));
        }
    }
}

// =============================================
// Application Entry Point
// =============================================
const app = new RexermiApp();
app.start().catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
