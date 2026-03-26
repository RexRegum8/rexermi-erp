// ============================================================
// Rexermi ERP v2.0 — Application Configuration
// Centralized config with environment variable support
// ============================================================

import path from 'path';
import fs from 'fs';

export interface AppConfig {
    app: {
        name: string;
        version: string;
        env: 'development' | 'production';
    };
    database: {
        path: string;
        walMode: boolean;
    };
    server: {
        port: number;
        host: string;
        corsOrigins: string[];
    };
    auth: {
        jwtSecret: string;
        jwtExpiresIn: string;
        bcryptRounds: number;
        adminPassword?: string;
    };
    cache: {
        maxKeys: number;
        stdTTLSeconds: number;
        checkPeriodSeconds: number;
        maxMemoryMB: number;
    };
    github: {
        owner: string;
        repo: string;
        checkIntervalMinutes: number;
    };
    cloudflare: {
        executablePath: string;
        tunnelToken: string;
    };
    logging: {
        dir: string;
        level: string;
    };
    plugins: {
        dir: string;
    };
}

const ROOT_DIR = process.cwd();

export function loadConfig(): AppConfig {
    // Try loading from config file
    const configPath = path.join(ROOT_DIR, 'rexermi.config.json');
    let fileConfig: Partial<AppConfig> = {};
    
    if (fs.existsSync(configPath)) {
        try {
            fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch {
            console.warn('[Config] Failed to parse rexermi.config.json, using defaults');
        }
    }

    const config: AppConfig = {
        app: {
            name: 'Rexermi ERP',
            version: '2.0.0',
            env: (process.env.NODE_ENV as 'development' | 'production') || 'development',
            ...fileConfig.app,
        },
        database: {
            path: path.join(ROOT_DIR, 'data', 'rexermi.db'),
            walMode: true, // WAL mode for concurrent reads — great for RAM performance
            ...fileConfig.database,
        },
        server: {
            port: parseInt(process.env.PORT || '5000', 10),
            host: '0.0.0.0',
            corsOrigins: ['http://localhost:3000', 'http://localhost:5000'],
            ...fileConfig.server,
        },
        auth: {
            jwtSecret: process.env.JWT_SECRET || 'rexermi-dev-secret-change-in-production',
            jwtExpiresIn: '24h',
            bcryptRounds: 12,
            adminPassword: process.env.ADMIN_PASSWORD,
            ...fileConfig.auth,
        },
        cache: {
            maxKeys: 100000,
            stdTTLSeconds: 1800, // 30 minutes
            checkPeriodSeconds: 120,
            maxMemoryMB: 8192, // 8GB — conservative for 24GB system
            ...fileConfig.cache,
        },
        github: {
            owner: process.env.GITHUB_OWNER || 'rexermi',
            repo: process.env.GITHUB_REPO || 'rexermi-erp',
            checkIntervalMinutes: 60,
            ...fileConfig.github,
        },
        cloudflare: {
            executablePath: path.join(ROOT_DIR, 'bin', 'cloudflared.exe'),
            tunnelToken: process.env.CLOUDFLARE_TUNNEL_TOKEN || '',
            ...fileConfig.cloudflare,
        },
        logging: {
            dir: path.join(ROOT_DIR, 'logs'),
            level: 'debug',
            ...fileConfig.logging,
        },
        plugins: {
            dir: path.join(ROOT_DIR, 'plugins'),
            ...fileConfig.plugins,
        },
    };

    return config;
}

export const DEFAULT_CAPABILITIES = [
    { code: 'system_admin', module: 'System', description: 'Acceso total al sistema' },
    { code: 'can_view_dashboard', module: 'Dashboard', description: 'Ver panel principal' },
    { code: 'can_edit_accounting', module: 'Accounting', description: 'Editar asientos contables' },
    { code: 'can_view_accounting', module: 'Accounting', description: 'Ver datos contables' },
    { code: 'can_edit_marketing', module: 'Marketing', description: 'Editar campañas de marketing' },
    { code: 'can_view_marketing', module: 'Marketing', description: 'Ver analítica de marketing' },
    { code: 'can_manage_users', module: 'System', description: 'Crear/editar/eliminar usuarios' },
    { code: 'can_manage_roles', module: 'System', description: 'Crear/editar roles y permisos' },
    { code: 'can_manage_webserver', module: 'WebServer', description: 'Configurar servidor web' },
    { code: 'can_view_logs', module: 'System', description: 'Ver logs del sistema' },
    { code: 'can_manage_inventory', module: 'Inventory', description: 'Gestionar inventario' },
    { code: 'can_view_inventory', module: 'Inventory', description: 'Ver inventario' },
    { code: 'can_process_sales', module: 'POS', description: 'Procesar ventas en punto de venta' },
    { code: 'can_view_reports', module: 'Reports', description: 'Ver reportes y estadísticas' },
] as const;
