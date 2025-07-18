# Hosts Manager VS Code Extension

A modern VS Code extension for managing your `/etc/hosts` file with a fast, secure, and user-friendly interface. Includes shell integration, backup management, and real-time updates.

## Features

- **Add, Edit, Delete Host Entries**: Manage entries directly from the sidebar or web panel
- **Enable/Disable Entries**: Toggle host entries with a single click (context menu or web panel)
- **Visual Tree View**: Browse all host entries with status indicators (enabled/disabled)
- **Web Panel**: Table view for bulk management, editing, toggling, and deleting entries
- **Automatic Backups**: Create and restore backups before making changes
- **Backup Management**: View, restore, and delete backups from the sidebar
- **Shell Integration**: Execute commands using your preferred shell (zsh, bash, fish, sh)
- **Elevated Privileges**: Sudo authentication for system file changes
- **Real-time Updates**: Auto-refresh when hosts file changes externally
- **Status Bar & Notifications**: Quick access and feedback for all major actions

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Hosts Manager"
4. Click Install

## Usage

### Commands (Command Palette)

- `Hosts Manager: Open Hosts File` – Open hosts file in editor
- `Hosts Manager: Add Host Entry` – Add a new host entry
- `Hosts Manager: Toggle Host Entry` – Enable/disable a host entry
- `Hosts Manager: Edit Host Entry` – Edit an existing host entry
- `Hosts Manager: Delete Host Entry` – Delete a host entry
- `Hosts Manager: Backup Hosts File` – Create a backup
- `Hosts Manager: Restore Hosts File` – Restore from a backup
- `Hosts Manager: Show Hosts Panel` – Open the web-based management panel
- `Hosts Manager: Flush DNS Cache` – Flush DNS cache (macOS/Linux/Windows)
- `Hosts Manager: Open Backup Folder` – Open backup location
- `Hosts Manager: Cleanup All Backups` – Remove all backups

### Tree View (Sidebar)

- View all host entries with status (enabled/disabled)
- Right-click for context menu: Enable, Disable, Edit, Delete, Open Hosts File
- Backup view: Restore, Delete, Cleanup backups

### Web Panel

- Table view of all entries (IP, hostname, comment, status)
- Add, edit, delete, enable/disable entries
- Backup and restore actions
- Real-time refresh and notifications

## Configuration

Configure the extension in VS Code settings:

```json
{
  "hostsManager.autoBackup": true,
  "hostsManager.backupLocation": "/path/to/backups",
  "hostsManager.shell": "zsh"
}
```

### Settings

- `hostsManager.autoBackup` (boolean): Automatically backup hosts file before changes (default: true)
- `hostsManager.backupLocation` (string): Custom backup location (default: extension directory)
- `hostsManager.shell` (string): Preferred shell for executing commands (default: "zsh")

## Permissions

This extension requires elevated privileges to modify the hosts file.

### macOS/Linux

- Prompts for sudo authentication when needed
- Ensure your user has sudo privileges

### Windows

- Run VS Code as Administrator for full functionality
- The extension will attempt to use elevated commands when possible

## File Locations

- **macOS/Linux**: `/etc/hosts`
- **Windows**: `C:\Windows\System32\drivers\etc\hosts`

## Security

- Automatic backups before modifications
- Error handling and user confirmation for all destructive actions
- Temporary files are cleaned up after operations
- No sensitive data is stored or transmitted

## Development

To contribute or modify this extension:

1. Clone the repository
2. Run `npm install`
3. Open in VS Code
4. Press F5 to launch in development mode

### Building

```bash
npm run compile  # Compile TypeScript
npm run watch    # Watch for changes
npm run package  # Create .vsix package
```

## Requirements

- VS Code 1.74.0 or higher
- Node.js for development
- Appropriate system permissions for hosts file access

## Known Issues

- Requires elevated privileges for hosts file modifications
- Some antivirus software may flag hosts file changes
- File watching may not work on some network drives

## License

MIT License - see LICENSE file for details

## Support

- Report issues on GitHub
- Feature requests welcome
- Community support available

---

**Note**: This extension modifies system files and requires appropriate permissions. Always review changes before applying them to production systems.
