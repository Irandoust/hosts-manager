import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { HostsManager, HostEntry } from '../src/hostsManager';
import { ShellExecutor } from '../src/shellExecutor';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      access: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
    }
  };
});

vi.mock('vscode', async () => {
  return {
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn(() => true)
      })),
      openTextDocument: vi.fn(),
    },
    window: {
      showTextDocument: vi.fn(),
      showErrorMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showQuickPick: vi.fn(),
      showInputBox: vi.fn(() => Promise.resolve('mocked'))
    }
  };
});

// Full mock for ShellExecutor
const mockShellExecutor = {
  shell: 'bash',

  execute: vi.fn(() => Promise.resolve('')),
  executeWithSudo: vi.fn(() => Promise.resolve('')),
  executeWithMacOSAuth: vi.fn(() => Promise.resolve('')),
  checkSudoAccess: vi.fn(() => Promise.resolve(true)),
  getShellPath: vi.fn(() => '/bin/bash'),
  quoteArg: vi.fn((arg: string) => `'${arg}'`),
  normalizeCommand: vi.fn((cmd: string) => cmd),
  buildCommand: vi.fn((cmd: string) => cmd),
  getErrorOutput: vi.fn(() => ''),
  warnIfWindowsSudo: vi.fn(() => {})
} as unknown as ShellExecutor;

describe('HostsManager', () => {
  let hostsManager: HostsManager;

  beforeEach(() => {
    hostsManager = new HostsManager(mockShellExecutor);
    vi.clearAllMocks();
  });

  it('should parse enabled and disabled host entries', () => {
    const mockContent = `
127.0.0.1 localhost
# 192.168.0.1 mysite.local # test comment
`;
    const entries = hostsManager.parseHostsFile(mockContent);
    expect(entries).toHaveLength(2);

    const [entry1, entry2] = entries;

    expect(entry1.hostname).toBe('localhost');
    expect(entry1.isEnabled).toBe(true);

    expect(entry2.hostname).toBe('mysite.local');
    expect(entry2.isEnabled).toBe(false);
    expect(entry2.comment).toBe('test comment');
  });

  it('should throw an error when reading fails', async () => {
    (fs.promises.readFile as any).mockRejectedValue(new Error('fail'));

    await expect(hostsManager.readHostsFile()).rejects.toThrow('Cannot read hosts file');
  });

  it('should write hosts file with a backup', async () => {
    const content = '127.0.0.1 localhost';

    (fs.promises.writeFile as any).mockResolvedValue(undefined);
    (fs.promises.readFile as any).mockResolvedValue(content);
    (fs.promises.unlink as any).mockResolvedValue(undefined);
    (fs.promises.mkdir as any).mockResolvedValue(undefined);

    await expect(hostsManager.writeHostsFile(content)).resolves.not.toThrow();
    expect(mockShellExecutor.executeWithSudo).toHaveBeenCalled();
  });

  it('should disable a host entry by commenting it', async () => {
    const content = `127.0.0.1 localhost\n192.168.1.1 mysite.local`;
    (fs.promises.readFile as any).mockResolvedValue(content);
    (fs.promises.writeFile as any).mockResolvedValue(undefined);

    const entry: HostEntry = {
      ip: '192.168.1.1',
      hostname: 'mysite.local',
      isEnabled: true,
      lineNumber: 2
    };

    await hostsManager.disableHostEntry(entry);
    expect(fs.promises.writeFile).toHaveBeenCalled();
  });
});
