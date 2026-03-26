// ============================================================
// Rexermi ERP v2.0 — Cloudflare Tunnel Service
// Manages cloudflared.exe as a hidden child process
// ============================================================

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { ITunnelService, ILogger } from '../core/interfaces';
import { AppConfig } from '../core/config';

export class CloudflareTunnelService implements ITunnelService {
    private config: AppConfig;
    private logger: ILogger;
    private process: ChildProcess | null = null;
    private publicUrl: string | null = null;
    private restartAttempts: number = 0;
    private maxRestarts: number = 5;
    private restartDelay: number = 5000; // 5 seconds

    constructor(config: AppConfig, logger: ILogger) {
        this.config = config;
        this.logger = logger;
    }

    async start(localPort: number): Promise<void> {
        const { executablePath, tunnelToken } = this.config.cloudflare;

        // Check if cloudflared.exe exists
        if (!fs.existsSync(executablePath)) {
            this.logger.warn(`cloudflared.exe not found at: ${executablePath}`);
            this.logger.info('Download it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
            this.logger.info('Place it in the /bin/ directory');
            return;
        }

        if (!tunnelToken) {
            this.logger.warn('Cloudflare tunnel token not configured');
            this.logger.info('Set CLOUDFLARE_TUNNEL_TOKEN environment variable or add it to rexermi.config.json');
            return;
        }

        this.logger.info('Starting Cloudflare tunnel...');

        try {
            const args = [
                'tunnel',
                '--no-autoupdate',
                'run',
                '--token', tunnelToken,
            ];

            this.process = spawn(executablePath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,  // Hide the console window on Windows
                detached: false,     // Keep attached to parent for cleanup
            });

            // Capture stdout for URL detection
            this.process.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                this.logger.debug(`[cloudflared] ${output.trim()}`);

                // Detect the public URL from cloudflared output
                const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
                if (urlMatch) {
                    this.publicUrl = urlMatch[0];
                    this.logger.info(`☁️  Tunnel activo: ${this.publicUrl}`);
                }
            });

            // Capture errors
            this.process.stderr?.on('data', (data: Buffer) => {
                const output = data.toString().trim();
                if (output) {
                    this.logger.debug(`[cloudflared:err] ${output}`);
                }
            });

            // Handle process exit
            this.process.on('exit', (code, signal) => {
                this.logger.warn(`Cloudflare tunnel process exited`, { code, signal });
                this.process = null;
                this.publicUrl = null;

                // Auto-restart if not manually stopped
                if (code !== 0 && this.restartAttempts < this.maxRestarts) {
                    this.restartAttempts++;
                    this.logger.info(`Restarting tunnel (attempt ${this.restartAttempts}/${this.maxRestarts})...`);
                    setTimeout(() => this.start(localPort), this.restartDelay);
                }
            });

            this.process.on('error', (err) => {
                this.logger.error('Failed to start cloudflared', err);
            });

            // Reset restart counter on successful start
            this.restartAttempts = 0;

        } catch (err) {
            this.logger.error('Error starting Cloudflare tunnel', err as Error);
        }
    }

    async stop(): Promise<void> {
        if (this.process) {
            this.restartAttempts = this.maxRestarts; // Prevent auto-restart
            this.logger.info('Stopping Cloudflare tunnel...');

            // Graceful kill
            this.process.kill('SIGTERM');

            // Force kill after 5 seconds
            setTimeout(() => {
                if (this.process) {
                    this.process.kill('SIGKILL');
                    this.process = null;
                }
            }, 5000);

            this.publicUrl = null;
            this.logger.info('Cloudflare tunnel stopped');
        }
    }

    getPublicUrl(): string | null {
        return this.publicUrl;
    }

    isRunning(): boolean {
        return this.process !== null && !this.process.killed;
    }
}
