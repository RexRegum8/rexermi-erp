// ============================================================
// Rexermi ERP v2.0 — Sample Marketing Plugin
// Demonstrates the plugin system with capability-based access
// ============================================================

import { IPlugin, IServiceContainer, ILogger } from '../../src/core/interfaces';

export class MarketingPlugin implements IPlugin {
    readonly name = 'Marketing';
    readonly version = '1.0.0';
    readonly requiredCapabilities = ['can_view_marketing', 'can_edit_marketing'];

    private logger!: ILogger;

    async initialize(container: IServiceContainer): Promise<void> {
        this.logger = container.resolve<ILogger>('logger');
        this.logger.info('[Marketing] Plugin initialized');

        // TODO: Register marketing-specific routes
        // const webServer = container.resolve<WebServerPlugin>('webServer');
        // webServer.getApp()?.get('/api/marketing/campaigns', ...);
    }

    async shutdown(): Promise<void> {
        this.logger.info('[Marketing] Plugin shutdown');
    }
}

module.exports = { MarketingPlugin };
