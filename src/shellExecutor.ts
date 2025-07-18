import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ShellExecutor {
    private shell: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('hostsManager');
        this.shell = config.get('shell', 'zsh');
    }

    async execute(command: string): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(command, {
                shell: this.shell,
                timeout: 30000 // 30 second timeout
            });

            if (stderr) {
                console.warn('Shell command stderr:', stderr);
            }

            return stdout;
        } catch (error: any) {
            if (error.code === 'EACCES' || error.stderr?.includes('Permission denied')) {
                throw new Error('Permission denied. Please run VS Code with elevated privileges or use sudo.');
            }
            throw new Error(`Shell command failed: ${error.message}`);
        }
    }

    async executeWithSudo(command: string, customPrompt?: string): Promise<string> {
        // First check if we can run sudo without password (cached credentials)
        try {
            await this.execute('sudo -n true');
            // Credentials are cached, run the command
            const sudoCommand = `sudo ${command}`;
            return this.execute(sudoCommand);
        } catch (error) {
            // Need to authenticate - use osascript on macOS for password prompt
            if (process.platform === 'darwin') {
                return this.executeWithMacOSAuth(command, customPrompt);
            } else {
                // For Linux, we'll need a different approach
                throw new Error('Sudo authentication required. Please run "sudo echo test" in terminal first to cache credentials, then try again.');
            }
        }
    }

    private async executeWithMacOSAuth(command: string, customPrompt?: string): Promise<string> {
        try {
            // Escape the command properly for osascript
            // Replace double quotes with escaped quotes
            const escapedCommand = command.replace(/"/g, '\\"');

            // Create the osascript command with optional custom prompt
            let osascriptCommand: string;
            if (customPrompt) {
                // Use custom prompt text
                const escapedPrompt = customPrompt.replace(/"/g, '\\"');
                osascriptCommand = `osascript -e 'do shell script "sudo ${escapedCommand}" with administrator privileges with prompt "${escapedPrompt}"'`;
            } else {
                // Use default prompt
                osascriptCommand = `osascript -e 'do shell script "sudo ${escapedCommand}" with administrator privileges'`;
            }

            const { stdout, stderr } = await execAsync(osascriptCommand, {
                shell: this.shell,
                timeout: 60000 // 60 second timeout for user input
            });

            if (stderr) {
                console.warn('Shell command stderr:', stderr);
            }

            return stdout;
        } catch (error: any) {
            if (error.message.includes('User canceled')) {
                throw new Error('Operation cancelled by user');
            }
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    async checkSudoAccess(): Promise<boolean> {
        try {
            await this.execute('sudo -n true');
            return true;
        } catch (error) {
            return false;
        }
    }

    async promptForSudo(): Promise<void> {
        const result = await vscode.window.showInformationMessage(
            'This operation requires elevated privileges. Please enter your password in the terminal.',
            'OK', 'Cancel'
        );

        if (result !== 'OK') {
            throw new Error('Operation cancelled by user');
        }

        // Open terminal for sudo authentication
        const terminal = vscode.window.createTerminal('Hosts Manager - Sudo');
        terminal.show();
        terminal.sendText('sudo echo "Authentication successful"');
    }

    getShell(): string {
        return this.shell;
    }

    setShell(shell: string): void {
        this.shell = shell;
    }

    async testShellAccess(): Promise<boolean> {
        try {
            await this.execute('echo "test"');
            return true;
        } catch (error) {
            return false;
        }
    }

    async getShellInfo(): Promise<{ shell: string; version: string }> {
        try {
            const version = await this.execute(`${this.shell} --version`);
            return {
                shell: this.shell,
                version: version.trim()
            };
        } catch (error) {
            return {
                shell: this.shell,
                version: 'Unknown'
            };
        }
    }

    async executeInteractive(command: string): Promise<void> {
        const terminal = vscode.window.createTerminal({
            name: 'Hosts Manager',
            shellPath: this.shell
        });
        terminal.show();
        terminal.sendText(command);
    }

    async backupWithShell(sourcePath: string, backupPath: string): Promise<void> {
        const command = process.platform === 'win32'
            ? `copy "${sourcePath}" "${backupPath}"`
            : `cp "${sourcePath}" "${backupPath}"`;

        await this.execute(command);
    }

    async copyWithElevatedPrivileges(sourcePath: string, destPath: string): Promise<void> {
        const command = process.platform === 'win32'
            ? `copy "${sourcePath}" "${destPath}"`
            : `sudo cp "${sourcePath}" "${destPath}"`;

        await this.execute(command);
    }
}
