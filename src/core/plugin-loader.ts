// ============================================================
// Rexermi ERP v2.0 — Plugin Loader
// Discovers and loads plugins from the plugins directory
// ============================================================

import path from 'path';
import fs from 'fs';
import { IPlugin, IServiceContainer, ILogger } from './interfaces';

export class PluginLoader {
    private plugins: Map<string, IPlugin> = new Map();
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    /**
     * Discover and load all plugins from the given directory.
     * Each plugin folder must contain an index.js/ts that exports a class implementing IPlugin.
     */
    async discoverPlugins(pluginsDir: string): Promise<IPlugin[]> {
        const loaded: IPlugin[] = [];

        if (!fs.existsSync(pluginsDir)) {
            this.logger.info(`Plugins directory not found, creating: ${pluginsDir}`);
            fs.mkdirSync(pluginsDir, { recursive: true });
            return loaded;
        }

        const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const pluginPath = path.join(pluginsDir, entry.name);
            const indexFile = this.findPluginEntry(pluginPath);

            if (!indexFile) {
                this.logger.warn(`Plugin '${entry.name}' has no entry file, skipping`);
                continue;
            }

            try {
                const pluginModule = require(indexFile);
                const PluginClass = pluginModule.default || pluginModule[Object.keys(pluginModule)[0]];

                if (!PluginClass || typeof PluginClass !== 'function') {
                    this.logger.warn(`Plugin '${entry.name}' does not export a valid class`);
                    continue;
                }

                const plugin: IPlugin = new PluginClass();

                if (!this.validatePlugin(plugin)) {
                    this.logger.warn(`Plugin '${entry.name}' does not implement IPlugin interface`);
                    continue;
                }

                this.plugins.set(plugin.name, plugin);
                loaded.push(plugin);
                this.logger.info(`Discovered plugin: ${plugin.name} v${plugin.version}`);
            } catch (err) {
                this.logger.error(`Failed to load plugin '${entry.name}'`, err as Error);
            }
        }

        return loaded;
    }

    /**
     * Initialize all discovered plugins with the service container
     */
    async initializeAll(container: IServiceContainer): Promise<void> {
        for (const [name, plugin] of this.plugins) {
            try {
                this.logger.info(`Initializing plugin: ${name}`);
                await plugin.initialize(container);
                this.logger.info(`Plugin initialized: ${name} ✓`);
            } catch (err) {
                this.logger.error(`Failed to initialize plugin '${name}'`, err as Error);
            }
        }
    }

    /**
     * Gracefully shut down all plugins
     */
    async shutdownAll(): Promise<void> {
        for (const [name, plugin] of this.plugins) {
            try {
                this.logger.info(`Shutting down plugin: ${name}`);
                await plugin.shutdown();
            } catch (err) {
                this.logger.error(`Error shutting down plugin '${name}'`, err as Error);
            }
        }
        this.plugins.clear();
    }

    getPlugin(name: string): IPlugin | undefined {
        return this.plugins.get(name);
    }

    getAllPlugins(): IPlugin[] {
        return [...this.plugins.values()];
    }

    private findPluginEntry(pluginDir: string): string | null {
        const candidates = ['index.js', 'index.ts', 'plugin.js', 'plugin.ts'];
        for (const file of candidates) {
            const fullPath = path.join(pluginDir, file);
            if (fs.existsSync(fullPath)) return fullPath;
        }
        return null;
    }

    private validatePlugin(plugin: unknown): plugin is IPlugin {
        const p = plugin as IPlugin;
        return (
            typeof p.name === 'string' &&
            typeof p.version === 'string' &&
            Array.isArray(p.requiredCapabilities) &&
            typeof p.initialize === 'function' &&
            typeof p.shutdown === 'function'
        );
    }
}
