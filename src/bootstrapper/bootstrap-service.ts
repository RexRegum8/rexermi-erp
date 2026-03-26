// ============================================================
// Rexermi ERP v2.0 — Bootstrapper Module
// First-run detection + startup menu with 3 options
// ============================================================

import readline from 'readline';
import { IBootstrapper, ILogger, InstallationStatus, StartupChoice } from '../core/interfaces';
import { AppConfig } from '../core/config';
import { DatabaseService } from '../data/database';
import { AuthService } from '../auth/auth-service';
import { MemoryCacheService } from '../cache/memory-cache';

export class BootstrapService implements IBootstrapper {
    private db: DatabaseService;
    private authService: AuthService;
    private cacheService: MemoryCacheService;
    private config: AppConfig;
    private logger: ILogger;

    constructor(
        db: DatabaseService,
        authService: AuthService,
        cacheService: MemoryCacheService,
        config: AppConfig,
        logger: ILogger
    ) {
        this.db = db;
        this.authService = authService;
        this.cacheService = cacheService;
        this.config = config;
        this.logger = logger;
    }

    async detectInstallation(): Promise<InstallationStatus> {
        try {
            if (this.db.isFirstRun()) {
                this.logger.info('First-run detected: no tables found');
                return InstallationStatus.FRESH_INSTALL;
            }

            // Verify DB integrity
            const integrityCheck = this.db.queryOne<{ integrity_check: string }>("PRAGMA integrity_check");

            if (!integrityCheck || integrityCheck.integrity_check !== 'ok') {
                this.logger.error('Database integrity check failed!');
                return InstallationStatus.CORRUPTED;
            }

            this.logger.info('Existing installation detected');
            return InstallationStatus.EXISTING_INSTALL;

        } catch (err) {
            this.logger.error('Error detecting installation status', err as Error);
            return InstallationStatus.CORRUPTED;
        }
    }

    async runFirstTimeSetup(): Promise<void> {
        this.logger.info('═══════════════════════════════════════════');
        this.logger.info('  🚀 REXERMI ERP v2.0 — Primera Ejecución');
        this.logger.info('═══════════════════════════════════════════');

        // Initialize database schema
        this.db.initializeSchema();

        // Create admin password
        const defaultPassword = 'admin123'; // User should change this immediately
        const hashedPassword = await this.authService.hashPassword(defaultPassword);

        // Seed all default data
        this.db.seedDefaults(hashedPassword);

        this.logger.info('');
        this.logger.info('✅ Configuración inicial completada');
        this.logger.info('👤 Usuario: admin');
        this.logger.info('🔑 Contraseña: admin123 (¡Cámbiala inmediatamente!)');
        this.logger.info('');
    }

    async showStartupMenu(): Promise<StartupChoice> {
        console.log('');
        console.log('╔═══════════════════════════════════════════════════╗');
        console.log('║         🏢 REXERMI ERP v2.0 — Inicio             ║');
        console.log('╠═══════════════════════════════════════════════════╣');
        console.log('║                                                   ║');
        console.log('║  1️⃣  Sincronizar                                  ║');
        console.log('║     Comparar y descargar datos de la nube         ║');
        console.log('║                                                   ║');
        console.log('║  2️⃣  Sobrescribir                                 ║');
        console.log('║     Resetear datos locales desde la nube          ║');
        console.log('║                                                   ║');
        console.log('║  3️⃣  Rendimiento Máximo                           ║');
        console.log('║     Cargar todos los datos en RAM (24GB)          ║');
        console.log('║     ⚡ Velocidad máxima para contabilidad          ║');
        console.log('║                                                   ║');
        console.log('╚═══════════════════════════════════════════════════╝');
        console.log('');

        const choice = await this.promptUser('Seleccione una opción (1/2/3): ');

        switch (choice.trim()) {
            case '1':
                return StartupChoice.SYNC;
            case '2':
                return StartupChoice.OVERWRITE;
            case '3':
            default:
                return StartupChoice.MAX_PERFORMANCE;
        }
    }

    async executeChoice(choice: StartupChoice): Promise<void> {
        switch (choice) {
            case StartupChoice.SYNC:
                await this.executeSync();
                break;
            case StartupChoice.OVERWRITE:
                await this.executeOverwrite();
                break;
            case StartupChoice.MAX_PERFORMANCE:
                await this.executeMaxPerformance();
                break;
        }
    }

    // =============================================
    // Startup Choice Implementations
    // =============================================

    private async executeSync(): Promise<void> {
        this.logger.info('🔄 Modo Sincronización seleccionado');
        this.logger.info('Comparando datos locales con la nube...');

        // TODO: Implement cloud sync when cloud backend is ready
        // For now, just load local data
        this.logger.info('Cloud sync not configured — using local data');
        await this.preWarmEssentialTables();
    }

    private async executeOverwrite(): Promise<void> {
        this.logger.info('⚠️  Modo Sobrescribir seleccionado');
        this.logger.info('Descargando datos completos de la nube...');

        // TODO: Implement cloud overwrite when cloud backend is ready
        this.logger.info('Cloud overwrite not configured — keeping local data');
        await this.preWarmEssentialTables();
    }

    private async executeMaxPerformance(): Promise<void> {
        this.logger.info('⚡ Modo Rendimiento Máximo seleccionado');
        this.logger.info('Cargando TODOS los datos en memoria RAM...');

        const startTime = Date.now();

        // Get all tables from the database
        const tables = this.db.queryAll<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );

        let totalRows = 0;

        for (const table of tables) {
            try {
                const data = this.db.getAllFromTable(table.name);
                this.cacheService.preWarm(table.name, data);
                totalRows += data.length;
            } catch (err) {
                this.logger.error(`Failed to pre-warm table: ${table.name}`, err as Error);
            }
        }

        const elapsed = Date.now() - startTime;
        const stats = this.cacheService.getStats();

        this.logger.info('');
        this.logger.info('✅ Datos cargados en RAM');
        this.logger.info(`   📊 Tablas: ${tables.length}`);
        this.logger.info(`   📝 Registros: ${totalRows.toLocaleString()}`);
        this.logger.info(`   💾 Memoria: ${stats.memoryUsageMB}MB`);
        this.logger.info(`   ⏱️  Tiempo: ${elapsed}ms`);
        this.logger.info('');
    }

    /**
     * Pre-warm the most critical tables (used in sync/overwrite modes too)
     */
    private async preWarmEssentialTables(): Promise<void> {
        const criticalTables = ['users', 'roles', 'capabilities', 'role_capabilities', 'user_roles'];

        for (const table of criticalTables) {
            try {
                const data = this.db.getAllFromTable(table);
                this.cacheService.preWarm(table, data);
            } catch (err) {
                this.logger.debug(`Table '${table}' not found for pre-warming, skipping`);
            }
        }
    }

    // =============================================
    // Utility
    // =============================================

    private promptUser(question: string): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }
}
