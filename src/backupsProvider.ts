import * as vscode from 'vscode';
import * as path from 'path';
import { HostsManager } from './hostsManager';
import { Utils } from './utils';

export interface BackupItem {
    label: string;
    path: string;
    timestamp: Date;
    size: number;
}

export class BackupsProvider implements vscode.TreeDataProvider<BackupItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BackupItem | undefined | null | void> = new vscode.EventEmitter<BackupItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BackupItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private hostsManager: HostsManager) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BackupItem): vscode.TreeItem {
        const item = new vscode.TreeItem(
            element.label,
            vscode.TreeItemCollapsibleState.None
        );

        item.description = `${Utils.formatFileSize(element.size)} - ${Utils.formatDate(element.timestamp)}`;
        item.tooltip = `Backup: ${element.path}\nSize: ${Utils.formatFileSize(element.size)}\nCreated: ${Utils.formatDate(element.timestamp)}`;
        item.iconPath = new vscode.ThemeIcon('archive');
        item.contextValue = 'backupItem';

        item.command = {
            command: 'hosts-manager.restoreSpecificBackup',
            title: 'Restore Backup',
            arguments: [element]
        };

        return item;
    }

    async getChildren(element?: BackupItem): Promise<BackupItem[]> {
        if (!element) {
            try {
                const backupDir = await this.hostsManager.getBackupDirectory();
                const backups = await Utils.getBackupFiles(backupDir);

                if (backups.length === 0) {
                    // Return empty array - the welcome view will be shown automatically
                    return [];
                }

                return backups.map(backup => ({
                    label: path.basename(backup.path),
                    path: backup.path,
                    timestamp: backup.timestamp,
                    size: backup.size
                }));
            } catch (error) {
                console.error('Error loading backups:', error);
                return [];
            }
        }
        return [];
    }

    getParent(element: BackupItem): vscode.ProviderResult<BackupItem> {
        return null;
    }
}
