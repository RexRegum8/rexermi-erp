// ============================================================
// Rexermi ERP v2.0 — Sample Accounting Plugin
// Demonstrates the plugin system with capability-based access
// ============================================================

import { IPlugin, IServiceContainer, ILogger } from '../../src/core/interfaces';

export class AccountingPlugin implements IPlugin {
    readonly name = 'Accounting';
    readonly version = '1.0.0';
    readonly requiredCapabilities = ['can_view_accounting', 'can_edit_accounting'];

    private logger!: ILogger;

    async initialize(container: IServiceContainer): Promise<void> {
        this.logger = container.resolve<ILogger>('logger');
        this.logger.info('[Accounting] Plugin initialized');

        // TODO: Register accounting-specific routes
        // const webServer = container.resolve<WebServerPlugin>('webServer');
        // webServer.getApp()?.get('/api/accounting/ledger', ...);
    }

    async shutdown(): Promise<void> {
        this.logger.info('[Accounting] Plugin shutdown');
    }
}

// Default export for plugin loader
module.exports = { AccountingPlugin };
