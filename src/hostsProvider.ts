import * as vscode from 'vscode';
import { HostsManager, HostEntry } from './hostsManager';

export class HostsProvider implements vscode.TreeDataProvider<HostEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<HostEntry | undefined | null | void> = new vscode.EventEmitter<HostEntry | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HostEntry | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private hostsManager: HostsManager) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HostEntry): vscode.TreeItem {
        const item = new vscode.TreeItem(
            `${element.hostname} → ${element.ip}`,
            vscode.TreeItemCollapsibleState.None
        );

        item.description = element.comment || '';
        item.tooltip = `${element.ip} ${element.hostname}${element.comment ? ` # ${element.comment}` : ''}\nStatus: ${element.isEnabled ? 'Enabled' : 'Disabled'}`;

        // Set colors and icons based on status
        if (element.isEnabled) {
            // Green pass icon for enabled hosts
            item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
            // Use label with green text color for enabled hosts
            item.label = {
                label: `${element.hostname} → ${element.ip}`,
                highlights: []
            };
            item.resourceUri = vscode.Uri.parse(`enabled-host:${element.hostname}`);
        } else {
            // Red circle-slash icon for disabled hosts
            item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.red'));
            // Use label with gray text color for disabled hosts
            item.label = {
                label: `${element.hostname} → ${element.ip}`,
                highlights: []
            };
            item.resourceUri = vscode.Uri.parse(`disabled-host:${element.hostname}`);
        }

        item.contextValue = element.isEnabled ? 'enabledHost' : 'disabledHost';

        item.command = {
            command: 'hosts-manager.editEntry',
            title: 'Edit Host Entry',
            arguments: [element]
        };

        return item;
    }

    async getChildren(element?: HostEntry): Promise<HostEntry[]> {
        if (!element) {
            // Root level - return all host entries
            try {
                const entries = await this.hostsManager.getHostEntries();
                entries.forEach(e => {
                    console.log(`[getChildren] Host: ${e.hostname}, IP: ${e.ip}, isEnabled: ${e.isEnabled}, contextValue: ${e.isEnabled ? 'enabledHost' : 'disabledHost'}`);
                });
                return entries;
            } catch (error) {
                vscode.window.showErrorMessage(`Error loading hosts entries: ${error}`);
                return [];
            }
        }
        return [];
    }

    getParent(element: HostEntry): vscode.ProviderResult<HostEntry> {
        return null;
    }
}
