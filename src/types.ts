export interface ExtensionConfig {
    autoBackup: boolean;
    backupLocation: string;
    shell: string;
}

export interface HostsFileInfo {
    path: string;
    exists: boolean;
    readable: boolean;
    writable: boolean;
    size: number;
    lastModified: Date;
}

export interface BackupInfo {
    path: string;
    timestamp: Date;
    size: number;
}

export interface ShellInfo {
    shell: string;
    version: string;
    available: boolean;
}

export interface OperationResult {
    success: boolean;
    message?: string;
    error?: string;
}

export const SUPPORTED_SHELLS = ['bash', 'zsh', 'fish', 'sh'] as const;
export type SupportedShell = typeof SUPPORTED_SHELLS[number];

export const DEFAULT_CONFIG: ExtensionConfig = {
    autoBackup: true,
    backupLocation: '',
    shell: 'zsh'
};
