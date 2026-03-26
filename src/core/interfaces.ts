// ============================================================
// Rexermi ERP v2.0 — Core Plugin Interface
// All modules must implement this contract to be loaded by the kernel
// ============================================================

export interface IPlugin {
    /** Unique name of the plugin */
    readonly name: string;
    /** SemVer version string */
    readonly version: string;
    /** Capabilities required to access this plugin's features */
    readonly requiredCapabilities: string[];
    /** Initialize the plugin with access to the service container */
    initialize(container: IServiceContainer): Promise<void>;
    /** Graceful shutdown */
    shutdown(): Promise<void>;
}

export interface IServiceContainer {
    register<T>(key: string, instance: T): void;
    resolve<T>(key: string): T;
    has(key: string): boolean;
}

export interface ILogger {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, error?: Error, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
}

export interface ICacheService {
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttlSeconds?: number): void;
    del(key: string): void;
    flush(): void;
    getStats(): CacheStats;
    preWarm(tableName: string, data: unknown[]): void;
}

export interface CacheStats {
    hits: number;
    misses: number;
    keys: number;
    memoryUsageMB: number;
}

export interface IUpdateService {
    checkForUpdates(): Promise<UpdateInfo | null>;
    downloadUpdate(info: UpdateInfo, onProgress: (pct: number) => void): Promise<string>;
}

export interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    downloadUrl: string;
    releaseNotes: string;
    publishedAt: string;
}

export interface ITunnelService {
    start(localPort: number): Promise<void>;
    stop(): Promise<void>;
    getPublicUrl(): string | null;
    isRunning(): boolean;
}

export interface IAuthService {
    login(username: string, password: string): Promise<AuthResult>;
    verifyToken(token: string): TokenPayload | null;
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    userHasCapability(userId: string, capability: string): boolean;
    getUserCapabilities(userId: string): string[];
}

export interface AuthResult {
    success: boolean;
    token?: string;
    user?: {
        id: string;
        username: string;
        email: string;
        capabilities: string[];
    };
    error?: string;
}

export interface TokenPayload {
    userId: string;
    username: string;
    capabilities: string[];
    iat: number;
    exp: number;
}

export interface IBootstrapper {
    detectInstallation(): Promise<InstallationStatus>;
    runFirstTimeSetup(): Promise<void>;
    showStartupMenu(): Promise<StartupChoice>;
    executeChoice(choice: StartupChoice): Promise<void>;
}

export enum InstallationStatus {
    FRESH_INSTALL = 'FRESH_INSTALL',
    EXISTING_INSTALL = 'EXISTING_INSTALL',
    CORRUPTED = 'CORRUPTED',
}

export enum StartupChoice {
    SYNC = 'SYNC',
    OVERWRITE = 'OVERWRITE',
    MAX_PERFORMANCE = 'MAX_PERFORMANCE',
}
