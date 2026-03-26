// ============================================================
// Rexermi ERP v2.0 — Service Container (Dependency Injection)
// Lightweight IoC container for plugin and service management
// ============================================================

import { IServiceContainer, ILogger } from './interfaces';

export class ServiceContainer implements IServiceContainer {
    private services: Map<string, unknown> = new Map();
    private factories: Map<string, () => unknown> = new Map();

    register<T>(key: string, instance: T): void {
        this.services.set(key, instance);
    }

    registerFactory<T>(key: string, factory: () => T): void {
        this.factories.set(key, factory);
    }

    resolve<T>(key: string): T {
        // Check instances first
        if (this.services.has(key)) {
            return this.services.get(key) as T;
        }
        // Try factory
        if (this.factories.has(key)) {
            const instance = this.factories.get(key)!() as T;
            this.services.set(key, instance); // Cache the instance (singleton)
            return instance;
        }
        throw new Error(`[ServiceContainer] Service '${key}' not registered. Available: ${[...this.services.keys()].join(', ')}`);
    }

    has(key: string): boolean {
        return this.services.has(key) || this.factories.has(key);
    }

    getAll(): Map<string, unknown> {
        return new Map(this.services);
    }
}
