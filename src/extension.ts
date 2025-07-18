import * as vscode from 'vscode';
import { HostsProvider } from './hostsProvider';
import { BackupsProvider } from './backupsProvider';
import { HostsManager, HostEntry } from './hostsManager';
import { ShellExecutor } from './shellExecutor';
import { EXTENSION_NAME, STATUS_BAR_ICON } from './constants';
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('hosts-manager.testContextMenu', (entry: any) => {
            vscode.window.showInformationMessage('Test Host Context Menu clicked!');
        })
    );
    // ...existing code...
    // After hostsManager and hostsProvider are defined:
    const shellExecutor = new ShellExecutor();
    const hostsManager = new HostsManager(shellExecutor);
    const hostsProvider = new HostsProvider(hostsManager);
    const backupsProvider = new BackupsProvider(hostsManager);

    // Removed duplicate registrations for enableHost and disableHost
    console.log(`🚀 ${EXTENSION_NAME} extension activation started!`);

    try {
        const shellExecutor = new ShellExecutor();
        const hostsManager = new HostsManager(shellExecutor);
        const hostsProvider = new HostsProvider(hostsManager);
        const backupsProvider = new BackupsProvider(hostsManager);

        console.log('✅ All providers created successfully');

        // Register file decoration provider for colored text
        const decorationProvider = vscode.window.registerFileDecorationProvider({
            provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
                if (uri.scheme === 'enabled-host') {
                    return {
                        color: new vscode.ThemeColor('charts.green'),
                        tooltip: 'Enabled host entry'
                    };
                } else if (uri.scheme === 'disabled-host') {
                    return {
                        color: new vscode.ThemeColor('disabledForeground'),
                        tooltip: 'Disabled host entry'
                    };
                }
                return undefined;
            }
        });

        context.subscriptions.push(decorationProvider);

        // Register the tree data providers
        const mainTreeView = vscode.window.createTreeView('hostsManagerMain', {
            treeDataProvider: hostsProvider,
            showCollapseAll: true
        });

        const backupsTreeView = vscode.window.createTreeView('hostsManagerBackups', {
            treeDataProvider: backupsProvider,
            showCollapseAll: false
        });

        console.log('✅ Tree views registered successfully');

        // Update current backup path setting when configuration changes
        const updateCurrentBackupPath = async () => {
            try {
                const currentPath = await hostsManager.getBackupDirectory();
                const config = vscode.workspace.getConfiguration('hostsManager');
                await config.update('currentBackupPath', currentPath, vscode.ConfigurationTarget.Global);
            } catch (error) {
                console.error('Error updating current backup path:', error);
            }
        };

        // Update on startup
        updateCurrentBackupPath();

        // Update when configuration changes
        vscode.workspace.onDidChangeConfiguration(async event => {
            if (event.affectsConfiguration('hostsManager.backupLocation')) {
                updateCurrentBackupPath();
                backupsProvider.refresh();
            }
        });

        // Force reveal the Activity Bar view
        vscode.commands.executeCommand('setContext', 'hostsManagerActivated', true);

        // Try to reveal the hosts manager view with multiple attempts
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.view.extension.hostsManager');
        }, 1000);

        setTimeout(() => {
            vscode.commands.executeCommand('hostsManagerMain.focus');
        }, 2000);

        // Show initial notification with manual instruction
        vscode.window.showInformationMessage(
            `🌐 ${EXTENSION_NAME} extension activated! Look for the server icon in the Activity Bar or use Command Palette > "Show ${EXTENSION_NAME} View"`,
            'Show View'
        ).then(selection => {
            if (selection === 'Show View') {
                vscode.commands.executeCommand('workbench.view.extension.hostsManager');
            }
        }); console.log(`✅ ${EXTENSION_NAME} extension fully activated!`);

        // Register commands
        const commands = [
            vscode.commands.registerCommand('hosts-manager.openHostsFile', () => {
                hostsManager.openHostsFile();
            }),

            vscode.commands.registerCommand('hosts-manager.toggleHostEntry', async (entry?: HostEntry) => {
                if (entry) {
                    // If called from context menu with a specific entry
                    await hostsManager.toggleHostEntryFromTree(entry);
                    hostsProvider.refresh();
                } else {
                    // If called from command palette, show input box
                    const entryText = await vscode.window.showInputBox({
                        prompt: 'Enter host entry to toggle (e.g., "127.0.0.1 example.com")',
                        placeHolder: '127.0.0.1 example.com'
                    });
                    if (entryText) {
                        await hostsManager.toggleHostEntry(entryText);
                        hostsProvider.refresh();
                    }
                }
            }),

            vscode.commands.registerCommand('hosts-manager.addHostEntry', async () => {
                const ip = await vscode.window.showInputBox({
                    prompt: 'Enter IP address',
                    placeHolder: '127.0.0.1',
                    validateInput: (value) => {
                        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
                        return ipRegex.test(value) ? null : 'Please enter a valid IP address';
                    }
                });

                if (!ip) {
                    return;
                }

                const hostname = await vscode.window.showInputBox({
                    prompt: 'Enter hostname',
                    placeHolder: 'example.com',
                    validateInput: (value) => {
                        return value.trim().length > 0 ? null : 'Hostname cannot be empty';
                    }
                });

                if (hostname) {
                    await hostsManager.addHostEntry(ip, hostname);
                    hostsProvider.refresh();
                }
            }),

            vscode.commands.registerCommand('hosts-manager.showHostsPanel', () => {
                hostsManager.showHostsPanel();
            }),

            vscode.commands.registerCommand('hosts-manager.openHostsPanel', () => {
                hostsManager.showHostsPanel();
            }),

            vscode.commands.registerCommand('hosts-manager.backupHosts', async () => {
                await hostsManager.backupHostsFile();
                backupsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.restoreHosts', async () => {
                await hostsManager.restoreHostsFile();
                hostsProvider.refresh();
                backupsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.editEntry', async (entry: any) => {
                await hostsManager.editHostEntry(entry);
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.deleteEntry', async (entry: any) => {
                await hostsManager.deleteHostEntry(entry);
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.toggleEntry', async (entry: any) => {
                await hostsManager.toggleHostEntryFromTree(entry);
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.refresh', () => {
                hostsProvider.refresh();
                backupsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.refreshHosts', () => {
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.refreshBackups', () => {
                backupsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.restoreSpecificBackup', async (backupItem: any) => {
                const confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to restore from backup: ${backupItem.label}?`,
                    'Yes', 'No'
                );

                if (confirm === 'Yes') {
                    await hostsManager.restoreFromSpecificBackup(backupItem.path);
                    hostsProvider.refresh();
                    backupsProvider.refresh();
                }
            }),

            vscode.commands.registerCommand('hosts-manager.enableOnlyThis', async (entry: any) => {
                await hostsManager.enableOnlyThisEntry(entry);
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.enableHost', async (entry: any) => {
                await hostsManager.enableHostEntry(entry);
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.disableHost', async (entry: any) => {
                await hostsManager.disableHostEntry(entry);
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.editHost', async (entry: any) => {
                await hostsManager.editHostEntry(entry);
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.deleteHost', async (entry: any) => {
                await hostsManager.deleteHostEntry(entry);
                hostsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.flushDns', async () => {
                try {
                    const platform = process.platform;
                    let command: string;

                    if (platform === 'darwin') {
                        // macOS
                        command = 'dscacheutil -flushcache && killall -HUP mDNSResponder';
                    } else if (platform === 'win32') {
                        // Windows - may need to run as administrator
                        command = 'ipconfig /flushdns';
                    } else {
                        // Linux and other Unix-like systems
                        command = 'systemd-resolve --flush-caches';
                    }

                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Flushing DNS cache...",
                        cancellable: false
                    }, async (progress) => {
                        try {
                            if (platform === 'win32') {
                                // Windows doesn't need sudo, execute directly
                                await shellExecutor.execute(command);
                            } else {
                                // macOS and Linux need sudo, use the unified authentication with custom prompt
                                const customPrompt = `${EXTENSION_NAME} needs permission to flush DNS cache. Please enter your password:`;
                                await shellExecutor.executeWithSudo(command, customPrompt);
                            }

                            progress.report({ increment: 100 });
                        } catch (error) {
                            throw error;
                        }
                    });

                    vscode.window.showInformationMessage('DNS cache flushed successfully!');
                } catch (error) {
                    if (error instanceof Error && error.message.includes('cancelled')) {
                        vscode.window.showInformationMessage('DNS flush cancelled by user');
                    } else {
                        vscode.window.showErrorMessage(`Failed to flush DNS cache: ${error}`);
                    }
                }
            }),

            vscode.commands.registerCommand('hosts-manager.showView', () => {
                vscode.commands.executeCommand('workbench.view.extension.hostsManager');
            }),

            vscode.commands.registerCommand('hosts-manager.deleteBackup', async (backupItem: any) => {
                const confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete backup: ${backupItem.label}?`,
                    'Yes', 'No'
                );

                if (confirm === 'Yes') {
                    await hostsManager.deleteBackup(backupItem.path);
                    backupsProvider.refresh();
                }
            }),

            vscode.commands.registerCommand('hosts-manager.cleanupAllBackups', async () => {
                await hostsManager.cleanupAllBackups();
                backupsProvider.refresh();
            }),

            vscode.commands.registerCommand('hosts-manager.openBackupFolder', async () => {
                const backupDir = await hostsManager.getBackupDirectory();
                const uri = vscode.Uri.file(backupDir);
                await vscode.env.openExternal(uri);
            }),

            vscode.commands.registerCommand('hosts-manager.openSettings', () => {
                vscode.commands.executeCommand('workbench.action.openSettings', 'hostsManager');
            }),

            vscode.commands.registerCommand('hosts-manager.browseBackupLocation', async () => {
                const backupDir = await hostsManager.getBackupDirectory();
                const uri = vscode.Uri.file(backupDir);
                await vscode.env.openExternal(uri);
            }),

        ];

        context.subscriptions.push(...commands);

        // Status bar item
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = `${STATUS_BAR_ICON} ${EXTENSION_NAME}`;
        statusBarItem.command = 'hosts-manager.showHostsPanel';
        statusBarItem.tooltip = `Open ${EXTENSION_NAME}`;
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        // Auto-refresh when hosts file changes
        const hostsWatcher = vscode.workspace.createFileSystemWatcher(
            hostsManager.getHostsFilePath()
        );

        hostsWatcher.onDidChange(() => {
            console.log('🔄 Hosts file changed externally, refreshing...');
            hostsProvider.refresh();
            backupsProvider.refresh();
        });

        hostsWatcher.onDidCreate(() => {
            console.log('🔄 Hosts file created, refreshing...');
            hostsProvider.refresh();
            backupsProvider.refresh();
        });

        hostsWatcher.onDidDelete(() => {
            console.log('🔄 Hosts file deleted, refreshing...');
            hostsProvider.refresh();
            backupsProvider.refresh();
        });

        context.subscriptions.push(hostsWatcher);

        // Add Node.js fs watcher as fallback for system files
        try {
            const fs = require('fs');
            const nodeWatcher = fs.watch(hostsManager.getHostsFilePath(), (eventType: string, filename: string) => {
                if (eventType === 'change') {
                    console.log(`🔄 Node.js watcher: Hosts file changed (${eventType}), refreshing...`);
                    hostsProvider.refresh();
                    backupsProvider.refresh();

                    // Show notification that file was changed externally
                    vscode.window.showInformationMessage(
                        `📄 Hosts file was modified externally. ${EXTENSION_NAME} views have been refreshed.`,
                        'OK'
                    );
                }
            });

            context.subscriptions.push({
                dispose: () => {
                    nodeWatcher.close();
                }
            });
        } catch (error) {
            console.warn('⚠️ Could not set up Node.js file watcher:', error);
        }

        // Add periodic refresh as ultimate fallback (every 30 seconds)
        const periodicRefresh = setInterval(() => {
            // Only refresh if VS Code is active to avoid unnecessary resource usage
            if (vscode.window.state.focused) {
                hostsProvider.refresh();
            }
        }, 30000);

        context.subscriptions.push({
            dispose: () => {
                clearInterval(periodicRefresh);
            }
        });

    } catch (error) {
        console.error(`❌ Error activating ${EXTENSION_NAME} extension:`, error);
        vscode.window.showErrorMessage(`Failed to activate ${EXTENSION_NAME}: ${error}`);
    }
}

export function deactivate() {
    console.log(`${EXTENSION_NAME} extension is now deactivated!`);
}
