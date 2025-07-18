import * as vscode from 'vscode';

class SimpleTreeDataProvider implements vscode.TreeDataProvider<string> {
    getTreeItem(element: string): vscode.TreeItem {
        return {
            label: element,
            collapsibleState: vscode.TreeItemCollapsibleState.None
        };
    }

    getChildren(element?: string): string[] {
        if (!element) {
            return ['Hosts Manager is working!'];
        }
        return [];
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 SIMPLE TEST: Extension is activating!');

    // Show immediate notification
    vscode.window.showInformationMessage('🎉 TEST: Hosts Manager is working!');

    // Register the tree data provider for the Activity Bar view
    const treeDataProvider = new SimpleTreeDataProvider();
    vscode.window.createTreeView('hostsManagerMain', {
        treeDataProvider: treeDataProvider
    });

    // Register a simple command
    const disposable = vscode.commands.registerCommand('hosts-manager.test', () => {
        vscode.window.showInformationMessage('✅ Command works!');
    });

    context.subscriptions.push(disposable);

    console.log('✅ SIMPLE TEST: Extension activated successfully!');
}

export function deactivate() {
    console.log('❌ Extension deactivated');
}
