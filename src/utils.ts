import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HostsFileInfo, BackupInfo, OperationResult } from './types';

export class Utils {
    static async getHostsFileInfo(): Promise<HostsFileInfo> {
        const hostsPath = process.platform === 'win32'
            ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
            : '/etc/hosts';

        try {
            const stats = await fs.promises.stat(hostsPath);
            const readable = await this.checkFileAccess(hostsPath, fs.constants.R_OK);
            const writable = await this.checkFileAccess(hostsPath, fs.constants.W_OK);

            return {
                path: hostsPath,
                exists: true,
                readable,
                writable,
                size: stats.size,
                lastModified: stats.mtime
            };
        } catch (error) {
            return {
                path: hostsPath,
                exists: false,
                readable: false,
                writable: false,
                size: 0,
                lastModified: new Date(0)
            };
        }
    }

    static async checkFileAccess(filePath: string, mode: number): Promise<boolean> {
        try {
            await fs.promises.access(filePath, mode);
            return true;
        } catch (error) {
            return false;
        }
    }

    static async getBackupFiles(backupDir: string): Promise<BackupInfo[]> {
        try {
            const files = await fs.promises.readdir(backupDir);
            const backupFiles: BackupInfo[] = [];

            for (const file of files) {
                if (file.startsWith('hosts.backup.')) {
                    const filePath = path.join(backupDir, file);
                    try {
                        const stats = await fs.promises.stat(filePath);
                        backupFiles.push({
                            path: filePath,
                            timestamp: stats.mtime,
                            size: stats.size
                        });
                    } catch (error) {
                        console.warn(`Could not stat backup file ${filePath}:`, error);
                    }
                }
            }

            return backupFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        } catch (error) {
            return [];
        }
    }

    static formatFileSize(bytes: number): string {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static formatDate(date: Date): string {
        return date.toLocaleString();
    }

    static validateIPAddress(ip: string): boolean {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    static validateHostname(hostname: string): boolean {
        if (!hostname || hostname.length === 0) {
            return false;
        }

        // Basic hostname validation
        const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return hostnameRegex.test(hostname);
    }

    static async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
        } catch (error) {
            throw new Error(`Could not create directory ${dirPath}: ${error}`);
        }
    }

    static async showSystemInfo(): Promise<void> {
        const hostsInfo = await this.getHostsFileInfo();
        const platform = process.platform;
        const arch = process.arch;
        const nodeVersion = process.version;

        const info = `
**System Information**
- Platform: ${platform} (${arch})
- Node.js: ${nodeVersion}
- Hosts File: ${hostsInfo.path}
- File Exists: ${hostsInfo.exists}
- Readable: ${hostsInfo.readable}
- Writable: ${hostsInfo.writable}
- File Size: ${this.formatFileSize(hostsInfo.size)}
- Last Modified: ${this.formatDate(hostsInfo.lastModified)}
        `;

        vscode.window.showInformationMessage(info, { modal: true });
    }

    static async createTemporaryFile(content: string, prefix: string = 'hosts_temp'): Promise<string> {
        const tempDir = require('os').tmpdir();
        const tempFileName = `${prefix}_${Date.now()}.tmp`;
        const tempFilePath = path.join(tempDir, tempFileName);

        await fs.promises.writeFile(tempFilePath, content);
        return tempFilePath;
    }

    static async cleanupTemporaryFile(filePath: string): Promise<void> {
        try {
            await fs.promises.unlink(filePath);
        } catch (error) {
            console.warn('Could not cleanup temporary file:', error);
        }
    }

    static parseHostsLine(line: string): { ip: string; hostname: string; comment?: string; isEnabled: boolean } | null {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith('#')) {
            return null;
        }

        const isCommented = trimmedLine.startsWith('#');
        const activeLine = isCommented ? trimmedLine.substring(1).trim() : trimmedLine;

        const match = activeLine.match(/^(\S+)\s+(\S+)(?:\s*#(.*))?$/);
        if (match) {
            const [, ip, hostname, comment] = match;
            return {
                ip,
                hostname,
                comment: comment?.trim(),
                isEnabled: !isCommented
            };
        }

        return null;
    }

    static showOperationResult(result: OperationResult): void {
        if (result.success) {
            if (result.message) {
                vscode.window.showInformationMessage(result.message);
            }
        } else {
            vscode.window.showErrorMessage(result.error || 'Operation failed');
        }
    }
}
