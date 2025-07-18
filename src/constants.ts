// Constants for the extension
// Change EXTENSION_NAME here to rebrand the entire extension
export const EXTENSION_NAME = 'Hosts Manager';
export const EXTENSION_ID = 'hosts-manager';
export const EXTENSION_DISPLAY_NAME = 'Hosts Manager';
export const EXTENSION_DESCRIPTION = 'Manage /etc/hosts entries with shell access and quick toggle functionality';

// UI Constants
export const ACTIVITY_BAR_ICON = '$(server)';
export const STATUS_BAR_ICON = '$(globe)';

// Command IDs
export const COMMANDS = {
    showHostsPanel: 'hosts-manager.showHostsPanel',
    refreshHosts: 'hosts-manager.refreshHosts',
    toggleHost: 'hosts-manager.toggleHost',
    addHost: 'hosts-manager.addHost',
    editHost: 'hosts-manager.editHost',
    deleteHost: 'hosts-manager.deleteHost',
    backupHosts: 'hosts-manager.backupHosts',
    restoreHosts: 'hosts-manager.restoreHosts',
    resetHosts: 'hosts-manager.resetHosts',
    openHostsFile: 'hosts-manager.openHostsFile',
    openBackupsFolder: 'hosts-manager.openBackupsFolder'
};

// View IDs
export const VIEWS = {
    hostsManagerMain: 'hostsManagerMain',
    hostsManagerBackups: 'hostsManagerBackups'
} as const;
