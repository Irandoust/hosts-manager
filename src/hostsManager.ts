import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ShellExecutor } from './shellExecutor';
import { EXTENSION_NAME } from './constants';

export interface HostEntry {
    ip: string;
    hostname: string;
    comment?: string;
    isEnabled: boolean;
    lineNumber: number;
}

export class HostsManager {
    /**
     * Enable or disable a host entry and persist the change.
     */
    async setHostEnabled(entry: HostEntry, enabled: boolean): Promise<void> {
        // Update the entry's enabled state
        entry.isEnabled = enabled;
        // Persist the change (update hosts file)
        await this.editHostEntry(entry);
    }
    private shellExecutor: ShellExecutor;
    private hostsFilePath: string;

    constructor(shellExecutor: ShellExecutor) {
        this.shellExecutor = shellExecutor;
        this.hostsFilePath = process.platform === 'win32'
            ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
            : '/etc/hosts';
    }

    getHostsFilePath(): string {
        return this.hostsFilePath;
    }

    async openHostsFile(): Promise<void> {
        try {
            // Check if we have read access
            await this.checkAccess();

            const document = await vscode.workspace.openTextDocument(this.hostsFilePath);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Cannot open hosts file: ${error}`);
        }
    }

    async readHostsFile(): Promise<string> {
        try {
            return await fs.promises.readFile(this.hostsFilePath, 'utf8');
        } catch (error) {
            throw new Error(`Cannot read hosts file: ${error}`);
        }
    }

    async writeHostsFile(content: string): Promise<void> {
        try {
            // Create backup first if auto-backup is enabled
            const config = vscode.workspace.getConfiguration('hostsManager');
            if (config.get('autoBackup', true)) {
                await this.backupHostsFile();
            }

            // Use shell command to write with elevated privileges
            const tempFile = path.join(require('os').tmpdir(), `hosts_temp_${Date.now()}`);
            await fs.promises.writeFile(tempFile, content);

            const command = process.platform === 'win32'
                ? `copy "${tempFile}" "${this.hostsFilePath}"`
                : `cp "${tempFile}" "${this.hostsFilePath}"`;

            await this.shellExecutor.executeWithSudo(command, `${EXTENSION_NAME} needs permission to modify the hosts file. Please enter your password:`);

            // Clean up temp file
            await fs.promises.unlink(tempFile);

            vscode.window.showInformationMessage('Hosts file updated successfully!');
        } catch (error) {
            if (error instanceof Error && error.message.includes('cancelled')) {
                vscode.window.showWarningMessage('Operation cancelled by user');
            } else {
                vscode.window.showErrorMessage(`Cannot write hosts file: ${error}`);
            }
            throw error;
        }
    } parseHostsFile(content: string): HostEntry[] {
        const lines = content.split('\n');
        const entries: HostEntry[] = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Skip empty lines
            if (!trimmedLine) {
                return;
            }

            // Check if line is commented out
            const isCommented = trimmedLine.startsWith('#');
            let activeLine = trimmedLine;

            if (isCommented) {
                // Remove the # and get the content
                activeLine = trimmedLine.substring(1).trim();

                // Skip if it's just a comment without host entry
                if (!activeLine || !activeLine.match(/^\d+\.\d+\.\d+\.\d+\s+/)) {
                    return;
                }
            }

            // Parse the host entry
            const match = activeLine.match(/^(\S+)\s+(.+?)(?:\s*#(.*))?$/);
            if (match) {
                const [, ip, hostnames, comment] = match;
                const hosts = hostnames.split(/\s+/).filter(h => h.length > 0);

                hosts.forEach(hostname => {
                    entries.push({
                        ip,
                        hostname,
                        comment: comment?.trim(),
                        isEnabled: !isCommented,
                        lineNumber: index + 1
                    });
                });
            }
        });

        return entries;
    } async getHostEntries(): Promise<HostEntry[]> {
        try {
            const content = await this.readHostsFile();
            return this.parseHostsFile(content);
        } catch (error) {
            vscode.window.showErrorMessage(`Error reading hosts file: ${error}`);
            return [];
        }
    }

    async addHostEntry(ip: string, hostname: string, comment?: string): Promise<void> {
        try {
            const content = await this.readHostsFile();
            const newEntry = comment
                ? `${ip}\t${hostname}\t# ${comment}`
                : `${ip}\t${hostname}`;

            const updatedContent = content + '\n' + newEntry;
            await this.writeHostsFile(updatedContent);
        } catch (error) {
            vscode.window.showErrorMessage(`Error adding host entry: ${error}`);
        }
    }

    async toggleHostEntry(entryText: string): Promise<void> {
        try {
            const content = await this.readHostsFile();
            const lines = content.split('\n');
            let found = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Check if this line matches our entry (either commented or uncommented)
                if (line === entryText || line === `# ${entryText}`) {
                    if (line.startsWith('#')) {
                        // Uncomment the line
                        lines[i] = line.substring(1).trim();
                    } else {
                        // Comment the line
                        lines[i] = `# ${line}`;
                    }
                    found = true;
                    break;
                }
            }

            if (found) {
                await this.writeHostsFile(lines.join('\n'));
            } else {
                vscode.window.showWarningMessage('Host entry not found');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error toggling host entry: ${error}`);
        }
    }

    async toggleHostEntryFromTree(entry: HostEntry): Promise<void> {
        try {
            const content = await this.readHostsFile();
            const lines = content.split('\n');

            // Find the exact line that matches this entry
            let foundLineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const isCommented = line.startsWith('#');
                const activeLine = isCommented ? line.substring(1).trim() : line;

                // Check if this line contains our entry
                if (activeLine.includes(entry.ip) && activeLine.includes(entry.hostname)) {
                    foundLineIndex = i;
                    break;
                }
            }

            if (foundLineIndex !== -1) {
                const line = lines[foundLineIndex];
                if (line.trim().startsWith('#')) {
                    // Uncomment the line - remove the # and any leading whitespace after it
                    lines[foundLineIndex] = line.replace(/^\s*#\s*/, '');
                } else {
                    // Comment the line - add # at the beginning
                    lines[foundLineIndex] = `# ${line.trim()}`;
                }

                await this.writeHostsFile(lines.join('\n'));
                vscode.window.showInformationMessage(`Host entry ${entry.isEnabled ? 'disabled' : 'enabled'}: ${entry.hostname}`);
            } else {
                vscode.window.showWarningMessage('Could not find the host entry to toggle');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error toggling host entry: ${error}`);
        }
    } async editHostEntry(entry: HostEntry): Promise<void> {
        try {
            const newIp = await vscode.window.showInputBox({
                prompt: 'Enter new IP address',
                value: entry.ip,
                validateInput: (value) => {
                    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
                    return ipRegex.test(value) ? null : 'Please enter a valid IP address';
                }
            });

            if (!newIp) {
                return;
            }

            const newHostname = await vscode.window.showInputBox({
                prompt: 'Enter new hostname',
                value: entry.hostname,
                validateInput: (value) => {
                    return value.trim().length > 0 ? null : 'Hostname cannot be empty';
                }
            });

            if (!newHostname) {
                return;
            }

            const content = await this.readHostsFile();
            const lines = content.split('\n');

            if (entry.lineNumber > 0 && entry.lineNumber <= lines.length) {
                const lineIndex = entry.lineNumber - 1;
                const newLine = entry.comment
                    ? `${newIp}\t${newHostname}\t# ${entry.comment}`
                    : `${newIp}\t${newHostname}`;

                lines[lineIndex] = entry.isEnabled ? newLine : `# ${newLine}`;
                await this.writeHostsFile(lines.join('\n'));
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error editing host entry: ${error}`);
        }
    }

    async deleteHostEntry(entry: HostEntry): Promise<void> {
        try {
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete ${entry.ip} ${entry.hostname}?`,
                'Yes', 'No'
            );

            if (confirm === 'Yes') {
                const content = await this.readHostsFile();
                const lines = content.split('\n');

                if (entry.lineNumber > 0 && entry.lineNumber <= lines.length) {
                    lines.splice(entry.lineNumber - 1, 1);
                    await this.writeHostsFile(lines.join('\n'));
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error deleting host entry: ${error}`);
        }
    }

    async backupHostsFile(): Promise<void> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `hosts.backup.${timestamp}`;

            const backupDir = await this.getBackupDirectory();
            const backupPath = path.join(backupDir, backupFileName);

            const content = await this.readHostsFile();
            await fs.promises.writeFile(backupPath, content);

            // Auto-cleanup old backups based on maxBackups setting
            await this.cleanupOldBackups();

            vscode.window.showInformationMessage(`Hosts file backed up to: ${backupPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error backing up hosts file: ${error}`);
        }
    }

    private async cleanupOldBackups(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('hostsManager');
            const maxBackups = config.get('maxBackups', 10) as number;

            const backupFiles = await this.getBackupFiles();

            if (backupFiles.length > maxBackups) {
                // Sort by modification time (newest first) and remove excess files
                const filesToDelete = backupFiles.slice(maxBackups);

                for (const file of filesToDelete) {
                    await fs.promises.unlink(file);
                }

                if (filesToDelete.length > 0) {
                    console.log(`Cleaned up ${filesToDelete.length} old backup files`);
                }
            }
        } catch (error) {
            console.error('Error cleaning up old backups:', error);
        }
    }

    async restoreHostsFile(): Promise<void> {
        try {
            const backupFiles = await this.getBackupFiles();

            if (backupFiles.length === 0) {
                vscode.window.showWarningMessage('No backup files found');
                return;
            }

            const selectedBackup = await vscode.window.showQuickPick(
                backupFiles.map(file => ({
                    label: path.basename(file),
                    description: file
                })),
                { placeHolder: 'Select a backup file to restore' }
            );

            if (selectedBackup) {
                const content = await fs.promises.readFile(selectedBackup.description, 'utf8');
                await this.writeHostsFile(content);
                vscode.window.showInformationMessage('Hosts file restored successfully!');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error restoring hosts file: ${error}`);
        }
    }

    async restoreFromSpecificBackup(backupPath: string): Promise<void> {
        try {
            const content = await fs.promises.readFile(backupPath, 'utf8');
            await this.writeHostsFile(content);
            vscode.window.showInformationMessage('Hosts file restored successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Error restoring hosts file: ${error}`);
        }
    }

    async deleteBackup(backupPath: string): Promise<void> {
        try {
            await fs.promises.unlink(backupPath);
            vscode.window.showInformationMessage(`Backup deleted: ${path.basename(backupPath)}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error deleting backup: ${error}`);
        }
    }

    async cleanupAllBackups(): Promise<void> {
        try {
            const backupFiles = await this.getBackupFiles();

            if (backupFiles.length === 0) {
                vscode.window.showInformationMessage('No backup files found to cleanup.');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete all ${backupFiles.length} backup files? This action cannot be undone.`,
                { modal: true },
                'Delete All', 'Cancel'
            );

            if (confirm === 'Delete All') {
                let deletedCount = 0;
                for (const backupFile of backupFiles) {
                    try {
                        await fs.promises.unlink(backupFile);
                        deletedCount++;
                    } catch (error) {
                        console.warn(`Failed to delete backup ${backupFile}:`, error);
                    }
                }

                vscode.window.showInformationMessage(`Successfully deleted ${deletedCount} backup files.`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error cleaning up backups: ${error}`);
        }
    }

    async enableOnlyThisEntry(targetEntry: HostEntry): Promise<void> {
        try {
            const content = await this.readHostsFile();
            const lines = content.split('\n');

            // Find all entries with the same IP
            const updatedLines = lines.map(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) {
                    return line;
                }

                const isCommented = trimmedLine.startsWith('#');
                const activeLine = isCommented ? trimmedLine.substring(1).trim() : trimmedLine;

                // Check if this line contains a host entry with the target IP
                if (activeLine.includes(targetEntry.ip) && activeLine.match(/^\d+\.\d+\.\d+\.\d+\s+/)) {
                    // Check if this is the target entry
                    if (activeLine.includes(targetEntry.hostname)) {
                        // Enable this entry (remove comment if present)
                        return isCommented ? activeLine : line;
                    } else {
                        // Disable other entries with same IP (add comment if not present)
                        return isCommented ? line : `# ${trimmedLine}`;
                    }
                }

                return line;
            });

            await this.writeHostsFile(updatedLines.join('\n'));
            vscode.window.showInformationMessage(`Enabled ${targetEntry.hostname} and disabled other entries with IP ${targetEntry.ip}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error managing host entries: ${error}`);
        }
    }

    async enableHostEntry(entry: HostEntry): Promise<void> {
        try {
            const content = await this.readHostsFile();
            const lines = content.split('\n');

            // Find all entries with the same IP and enable only the target entry
            const updatedLines = lines.map(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) {
                    return line;
                }

                const isCommented = trimmedLine.startsWith('#');
                const activeLine = isCommented ? trimmedLine.substring(1).trim() : trimmedLine;

                // Check if this line contains a host entry with the target IP
                if (activeLine.includes(entry.ip) && activeLine.match(/^\d+\.\d+\.\d+\.\d+\s+/)) {
                    // Check if this is the target entry
                    if (activeLine.includes(entry.hostname)) {
                        // Enable this entry (remove comment if present)
                        return isCommented ? activeLine : line;
                    } else {
                        // Disable other entries with same IP (add comment if not present)
                        return isCommented ? line : `# ${trimmedLine}`;
                    }
                }

                return line;
            });

            await this.writeHostsFile(updatedLines.join('\n'));
            vscode.window.showInformationMessage(`Enabled ${entry.hostname} and disabled other entries with IP ${entry.ip}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error enabling host entry: ${error}`);
        }
    }

    async disableHostEntry(entry: HostEntry): Promise<void> {
        try {
            const content = await this.readHostsFile();
            const lines = content.split('\n');

            const updatedLines = lines.map(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine.startsWith('#') &&
                    trimmedLine.includes(entry.ip) &&
                    trimmedLine.includes(entry.hostname) &&
                    trimmedLine.match(/^\d+\.\d+\.\d+\.\d+\s+/)) {
                    // Add comment to disable
                    return `# ${trimmedLine}`;
                }
                return line;
            });

            await this.writeHostsFile(updatedLines.join('\n'));
            vscode.window.showInformationMessage(`Disabled host entry: ${entry.hostname}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error disabling host entry: ${error}`);
        }
    }

    async getBackupDirectory(): Promise<string> {
        const config = vscode.workspace.getConfiguration('hostsManager');
        const backupLocation = config.get('backupLocation', 'default') as string;
        let backupDir: string;
        switch (backupLocation) {
            case 'default':
                backupDir = path.join(__dirname, 'backups');
                break;
            case '~/Documents/HostsBackups':
                backupDir = path.join(require('os').homedir(), 'Documents', 'HostsBackups');
                break;
            case '~/Library/Application Support/hosts-manager/backups':
                backupDir = path.join(require('os').homedir(), 'Library', 'Application Support', 'hosts-manager', 'backups');
                break;
            default:
                if (backupLocation.startsWith('~/')) {
                    backupDir = path.join(require('os').homedir(), backupLocation.slice(2));
                } else {
                    backupDir = path.join(__dirname, 'backups');
                }
        }
        await fs.promises.mkdir(backupDir, { recursive: true });
        return backupDir;
    }




    private async getBackupFiles(): Promise<string[]> {
        try {
            const backupDir = await this.getBackupDirectory();
            const files = await fs.promises.readdir(backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('hosts.backup.'))
                .map(file => path.join(backupDir, file));

            // Sort by modification time (newest first)
            const filesWithStats = await Promise.all(
                backupFiles.map(async file => {
                    try {
                        const stats = await fs.promises.stat(file);
                        return { file, mtime: stats.mtime };
                    } catch (error) {
                        return { file, mtime: new Date(0) };
                    }
                })
            );

            return filesWithStats
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
                .map(item => item.file);
        } catch (error) {
            return [];
        }
    }

    async showHostsPanel(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'hostsManager',
            EXTENSION_NAME,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Get initial data
        const entries = await this.getHostEntries();

        // Set the HTML content directly
        panel.webview.html = this.getWebviewContent(entries);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.command) {
                    case 'refresh':
                        const refreshedEntries = await this.getHostEntries();
                        panel.webview.html = this.getWebviewContent(refreshedEntries);
                        break;

                    case 'addHost':
                        await this.addHostEntry(message.ip, message.domain, message.comment);
                        const addedEntries = await this.getHostEntries();
                        panel.webview.html = this.getWebviewContent(addedEntries);
                        break;

                    case 'toggleHost':
                        const toggleEntries = await this.getHostEntries();
                        if (message.index < toggleEntries.length) {
                            await this.enableHostEntry(toggleEntries[message.index]);
                            const updatedToggleEntries = await this.getHostEntries();
                            panel.webview.html = this.getWebviewContent(updatedToggleEntries);
                        }
                        break;

                    case 'editHost':
                        const editEntries = await this.getHostEntries();
                        if (message.index < editEntries.length) {
                            await this.editHostEntry(editEntries[message.index]);
                            const updatedEditEntries = await this.getHostEntries();
                            panel.webview.html = this.getWebviewContent(updatedEditEntries);
                        }
                        break;

                    case 'deleteHost':
                        const deleteEntries = await this.getHostEntries();
                        if (message.index < deleteEntries.length) {
                            await this.deleteHostEntry(deleteEntries[message.index]);
                            const updatedDeleteEntries = await this.getHostEntries();
                            panel.webview.html = this.getWebviewContent(updatedDeleteEntries);
                        }
                        break;

                    case 'backup':
                        await this.backupHostsFile();
                        break;

                    default:
                        console.log('Unknown webview message:', message);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error}`);
            }
        });
    }

    private getWebviewContent(entries: HostEntry[]): string {
        const entriesHtml = entries.map((entry, index) => `
            <div class="host-entry ${entry.isEnabled ? 'enabled' : 'disabled'}">
                <div class="host-info">
                    <div class="host-main">
                        <span class="host-ip">${entry.ip}</span>
                        <span class="host-arrow">→</span>
                        <span class="host-domain">${entry.hostname}</span>
                    </div>
                    ${entry.comment ? `<div class="host-comment"># ${entry.comment}</div>` : ''}
                </div>
                <div class="host-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${entry.isEnabled ? 'checked' : ''} 
                               onchange="toggleHost(${index})">
                        <span class="slider"></span>
                    </label>
                    <button class="btn btn-small btn-secondary" onclick="editHost(${index})">
                        Edit
                    </button>
                    <button class="btn btn-small btn-danger" onclick="deleteHost(${index})">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        const emptyState = entries.length === 0 ? `
            <div class="empty-state">
                <h3>No host entries found</h3>
                <p>Click "Add Entry" to create your first host entry</p>
            </div>
        ` : '';

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${EXTENSION_NAME}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        margin: 0;
                        padding: 20px;
                        line-height: 1.4;
                    }

                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 15px;
                        padding-bottom: 12px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }

                    .header h1 {
                        margin: 0;
                        color: var(--vscode-titleBar-activeForeground);
                        font-size: 24px;
                        font-weight: 600;
                    }

                    .actions {
                        display: flex;
                        gap: 6px;
                    }

                    .btn {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 4px 8px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 11px;
                        transition: background-color 0.2s;
                        font-family: inherit;
                    }

                    .btn:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }

                    .btn-secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }

                    .btn-secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }

                    .btn-small {
                        padding: 3px 6px;
                        font-size: 10px;
                        border-radius: 2px;
                    }

                    .btn-danger {
                        background-color: var(--vscode-errorForeground);
                        color: var(--vscode-editor-background);
                    }

                    .btn-danger:hover {
                        opacity: 0.8;
                    }

                    .add-form {
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        padding: 15px;
                        margin-bottom: 15px;
                        display: none;
                    }

                    .add-form.visible {
                        display: block;
                    }

                    .form-row {
                        display: flex;
                        gap: 8px;
                        margin-bottom: 12px;
                        align-items: center;
                    }

                    .form-row input {
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        color: var(--vscode-input-foreground);
                        padding: 5px 8px;
                        border-radius: 3px;
                        font-family: var(--vscode-editor-font-family, monospace);
                        font-size: 12px;
                        flex: 1;
                    }

                    .form-row input:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder);
                    }

                    .form-row label {
                        min-width: 70px;
                        color: var(--vscode-foreground);
                        font-weight: 500;
                        font-size: 12px;
                    }

                    .hosts-container {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .host-entry {
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        padding: 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        transition: border-color 0.2s, background-color 0.2s;
                    }

                    .host-entry:hover {
                        border-color: var(--vscode-focusBorder);
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .host-entry.disabled {
                        opacity: 0.6;
                        background-color: var(--vscode-list-inactiveSelectionBackground);
                    }

                    .host-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                    }

                    .host-main {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    .host-ip {
                        font-weight: 600;
                        color: var(--vscode-textLink-foreground);
                        font-family: var(--vscode-editor-font-family, monospace);
                    }

                    .host-arrow {
                        color: var(--vscode-descriptionForeground);
                    }

                    .host-domain {
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-editor-font-family, monospace);
                        font-weight: 500;
                    }

                    .host-comment {
                        color: var(--vscode-descriptionForeground);
                        font-size: 12px;
                        font-style: italic;
                    }

                    .host-actions {
                        display: flex;
                        gap: 6px;
                        align-items: center;
                    }

                    .toggle-switch {
                        position: relative;
                        display: inline-block;
                        width: 36px;
                        height: 18px;
                        margin-right: 8px;
                    }

                    .toggle-switch input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }

                    .slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        transition: .4s;
                        border-radius: 18px;
                    }

                    .slider:before {
                        position: absolute;
                        content: "";
                        height: 12px;
                        width: 12px;
                        left: 2px;
                        bottom: 2px;
                        background-color: var(--vscode-input-foreground);
                        transition: .4s;
                        border-radius: 50%;
                    }

                    input:checked + .slider {
                        background-color: var(--vscode-button-background);
                    }

                    input:checked + .slider:before {
                        transform: translateX(16px);
                    }

                    .empty-state {
                        text-align: center;
                        padding: 40px 20px;
                        color: var(--vscode-descriptionForeground);
                    }

                    .empty-state h3 {
                        margin-bottom: 10px;
                        color: var(--vscode-foreground);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🌐 ${EXTENSION_NAME}</h1>
                    <div class="actions">
                        <button class="btn btn-secondary btn-small" onclick="toggleAddForm()">
                            ➕ Add Entry
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="backupHosts()">
                            💾 Backup
                        </button>
                        <button class="btn btn-small" onclick="refreshHosts()">
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                <div class="add-form" id="addForm">
                    <h3>Add New Host Entry</h3>
                    <div class="form-row">
                        <label>IP Address:</label>
                        <input type="text" id="newIp" placeholder="127.0.0.1" />
                    </div>
                    <div class="form-row">
                        <label>Domain:</label>
                        <input type="text" id="newDomain" placeholder="example.local" />
                    </div>
                    <div class="form-row">
                        <label>Comment:</label>
                        <input type="text" id="newComment" placeholder="Optional comment" />
                    </div>
                    <div class="form-row">
                        <button class="btn btn-small" onclick="addHost()">Add Host</button>
                        <button class="btn btn-small btn-secondary" onclick="toggleAddForm()">Cancel</button>
                    </div>
                </div>

                <div class="hosts-container">
                    ${emptyState}
                    ${entriesHtml}
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    function toggleAddForm() {
                        const form = document.getElementById('addForm');
                        form.classList.toggle('visible');
                        if (form.classList.contains('visible')) {
                            document.getElementById('newIp').focus();
                        }
                    }

                    function addHost() {
                        const ip = document.getElementById('newIp').value.trim();
                        const domain = document.getElementById('newDomain').value.trim();
                        const comment = document.getElementById('newComment').value.trim();

                        if (!ip || !domain) {
                            alert('Please enter both IP and domain');
                            return;
                        }

                        vscode.postMessage({
                            command: 'addHost',
                            ip: ip,
                            domain: domain,
                            comment: comment
                        });

                        // Clear form
                        document.getElementById('newIp').value = '';
                        document.getElementById('newDomain').value = '';
                        document.getElementById('newComment').value = '';
                        toggleAddForm();
                    }

                    function toggleHost(index) {
                        vscode.postMessage({
                            command: 'toggleHost',
                            index: index
                        });
                    }

                    function editHost(index) {
                        vscode.postMessage({
                            command: 'editHost',
                            index: index
                        });
                    }

                    function deleteHost(index) {
                        if (confirm('Are you sure you want to delete this host entry?')) {
                            vscode.postMessage({
                                command: 'deleteHost',
                                index: index
                            });
                        }
                    }

                    function refreshHosts() {
                        vscode.postMessage({
                            command: 'refresh'
                        });
                    }

                    function backupHosts() {
                        vscode.postMessage({
                            command: 'backup'
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }

    private async checkAccess(): Promise<void> {
        try {
            await fs.promises.access(this.hostsFilePath, fs.constants.R_OK);
        } catch (error) {
            throw new Error('No read access to hosts file. Please run VS Code with elevated privileges.');
        }
    }
}
