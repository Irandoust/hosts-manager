import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShellExecutor } from '../src/shellExecutor';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn(() => ({ get: vi.fn(() => 'bash') }))
    },
    window: {
        showInformationMessage: vi.fn(() => Promise.resolve('OK')),
        createTerminal: vi.fn(() => ({
            show: vi.fn(),
            sendText: vi.fn()
        }))
    }
}));

vi.mock('util', async () => {
    const actual = await vi.importActual<typeof import('util')>('util');
    return {
        ...actual,
        promisify: vi.fn(() => vi.fn((cmd: string) => {
            if (cmd.includes('sudo -n true')) {
                return Promise.resolve({ stdout: '', stderr: '' });
            }
            if (cmd.includes('osascript')) {
                return Promise.resolve({ stdout: 'Success', stderr: '' });
            }
            if (cmd.includes('--version')) {
                return Promise.resolve({ stdout: 'Shell v1.2.3\n', stderr: '' });
            }
            return Promise.resolve({ stdout: 'test', stderr: '' });
        }))
    };
});

describe('ShellExecutor', () => {
    let executor: ShellExecutor;

    beforeEach(() => {
        executor = new ShellExecutor();
    });

    it('should get the shell from config', () => {
        expect(executor.getShell()).toBe('bash');
    });

    it('should execute shell commands', async () => {
        const result = await executor.execute('echo test');
        expect(result).toBe('test');
    });

    it('should check sudo access', async () => {
        const result = await executor.checkSudoAccess();
        expect(result).toBe(true);
    });

    it('should execute with sudo when credentials cached', async () => {
        const result = await executor.executeWithSudo('echo sudo test');
        expect(result).toBe('test');
    });

    it('should get shell info with version', async () => {
        const info = await executor.getShellInfo();
        expect(info).toEqual({ shell: 'bash', version: 'Shell v1.2.3' });
    });

    it('should backup with shell', async () => {
        await expect(executor.backupWithShell('/tmp/a', '/tmp/b')).resolves.toBeUndefined();
    });

    it('should copy with elevated privileges', async () => {
        await expect(executor.copyWithElevatedPrivileges('/tmp/a', '/tmp/b')).resolves.toBeUndefined();
    });

    it('should test shell access', async () => {
        const access = await executor.testShellAccess();
        expect(access).toBe(true);
    });

    it('should open terminal and run interactive command', async () => {
        await executor.executeInteractive('echo hi');
        expect(vscode.window.createTerminal).toHaveBeenCalled();
    });

    it('should prompt for sudo', async () => {
        await expect(executor.promptForSudo()).resolves.toBeUndefined();
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });
});
