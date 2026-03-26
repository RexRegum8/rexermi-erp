// ============================================================
// Rexermi ERP v2.0 — GitHub Update Service
// Async check for new releases using SemVer comparison
// ============================================================

import https from 'https';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
import { IUpdateService, UpdateInfo, ILogger } from '../core/interfaces';
import { AppConfig } from '../core/config';

export class GitHubUpdateService implements IUpdateService {
    private config: AppConfig;
    private logger: ILogger;
    private checkInterval: ReturnType<typeof setInterval> | null = null;

    constructor(config: AppConfig, logger: ILogger) {
        this.config = config;
        this.logger = logger;
    }

    /**
     * Check GitHub Releases API for a newer version
     */
    async checkForUpdates(): Promise<UpdateInfo | null> {
        const { owner, repo } = this.config.github;

        if (!owner || !repo) {
            this.logger.debug('GitHub update check skipped: owner/repo not configured');
            return null;
        }

        try {
            const release = await this.fetchLatestRelease(owner, repo);

            if (!release) {
                this.logger.debug('No releases found');
                return null;
            }

            const latestVersion = release.tag_name.replace(/^v/, '');
            const currentVersion = this.config.app.version;

            if (!semver.valid(latestVersion)) {
                this.logger.warn(`Invalid SemVer from GitHub: ${release.tag_name}`);
                return null;
            }

            if (semver.gt(latestVersion, currentVersion)) {
                // Find the first Windows binary asset
                const asset = release.assets?.find(
                    (a: GitHubAsset) =>
                        a.name.endsWith('.exe') ||
                        a.name.endsWith('.zip') ||
                        a.name.endsWith('.msi')
                );

                const updateInfo: UpdateInfo = {
                    currentVersion,
                    latestVersion,
                    downloadUrl: asset?.browser_download_url || release.html_url,
                    releaseNotes: release.body || 'Sin notas de la versión',
                    publishedAt: release.published_at,
                };

                this.logger.info(`🆕 Actualización disponible: v${currentVersion} → v${latestVersion}`);
                return updateInfo;
            }

            this.logger.info(`Sistema actualizado (v${currentVersion})`);
            return null;

        } catch (err) {
            this.logger.error('Error checking for updates', err as Error);
            return null;
        }
    }

    /**
     * Download a binary from the update URL with progress reporting
     */
    async downloadUpdate(info: UpdateInfo, onProgress: (pct: number) => void): Promise<string> {
        const downloadDir = path.join(process.cwd(), 'updates');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const fileName = path.basename(new URL(info.downloadUrl).pathname) || `rexermi-v${info.latestVersion}.zip`;
        const filePath = path.join(downloadDir, fileName);

        this.logger.info(`Downloading update: ${info.downloadUrl}`);

        return new Promise((resolve, reject) => {
            const request = https.get(info.downloadUrl, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        https.get(redirectUrl, (redirectResponse) => {
                            this.handleDownload(redirectResponse, filePath, onProgress, resolve, reject);
                        }).on('error', reject);
                        return;
                    }
                }

                this.handleDownload(response, filePath, onProgress, resolve, reject);
            });

            request.on('error', (err) => {
                this.logger.error('Download failed', err as Error);
                reject(err);
            });
        });
    }

    /**
     * Start periodic update checks
     */
    startPeriodicChecks(callback: (update: UpdateInfo) => void): void {
        const intervalMs = this.config.github.checkIntervalMinutes * 60 * 1000;

        this.checkInterval = setInterval(async () => {
            const update = await this.checkForUpdates();
            if (update) {
                callback(update);
            }
        }, intervalMs);

        this.logger.info(`Periodic update checks started (every ${this.config.github.checkIntervalMinutes} min)`);
    }

    stopPeriodicChecks(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    // =============================================
    // Private Helpers
    // =============================================

    private fetchLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: `/repos/${owner}/${repo}/releases/latest`,
                headers: {
                    'User-Agent': 'Rexermi-ERP/2.0',
                    'Accept': 'application/vnd.github.v3+json',
                },
            };

            https.get(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(data));
                    } else if (res.statusCode === 404) {
                        resolve(null);
                    } else {
                        reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
                    }
                });
            }).on('error', reject);
        });
    }

    private handleDownload(
        response: NodeJS.ReadableStream & { headers?: Record<string, string | string[] | undefined> },
        filePath: string,
        onProgress: (pct: number) => void,
        resolve: (path: string) => void,
        reject: (err: Error) => void
    ): void {
        const totalSize = parseInt((response as any).headers?.['content-length'] || '0', 10);
        let downloaded = 0;

        const file = fs.createWriteStream(filePath);

        response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            if (totalSize > 0) {
                const pct = Math.round((downloaded / totalSize) * 100);
                onProgress(pct);
            }
        });

        response.pipe(file);

        file.on('finish', () => {
            file.close();
            this.logger.info(`Update downloaded: ${filePath}`);
            resolve(filePath);
        });

        file.on('error', (err) => {
            fs.unlinkSync(filePath);
            reject(err);
        });
    }
}

// =============================================
// GitHub API Types
// =============================================

interface GitHubRelease {
    tag_name: string;
    html_url: string;
    body: string;
    published_at: string;
    assets: GitHubAsset[];
}

interface GitHubAsset {
    name: string;
    browser_download_url: string;
    size: number;
}
