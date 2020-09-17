import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import AksClusterTreeItem from './tree/aksClusterTreeItem';
import AzureAccountTreeItem from './tree/azureAccountTreeItem';
import { createTelemetryReporter, registerUIExtensionVariables, AzExtTreeDataProvider, AzureUserInput, registerCommand } from 'vscode-azureextensionui';
import selectSubscriptions from './commands/selectSubscriptions';
import detectorDiagnostics from './commands/detectorDiagnostics/detectorDiagnostics';
import periscope from './commands/periscope/periscope';
import * as clusters from './commands/utils/clusters';
import * as FileExplorer from './commands/fileSystem/Activator';

let useAdminCredential = false;

export async function activate(context: vscode.ExtensionContext) {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    useAdminCredential = vscode.workspace.getConfiguration().get('kubernetes.aks.useAdminCredential') as boolean;
    if (cloudExplorer.available) {
        // NOTE: This is boilerplate configuration for the Azure UI extension on which this extension relies.
        const uiExtensionVariables = {
            context,
            ignoreBundle: true,
            outputChannel: vscode.window.createOutputChannel('Azure Identity'),
            reporter: createTelemetryReporter(context),
            ui: new AzureUserInput(context.globalState)
        };

        context.subscriptions.push(uiExtensionVariables.outputChannel);

        registerUIExtensionVariables(uiExtensionVariables);

        registerCommand('aks.selectSubscriptions', selectSubscriptions);
        registerCommand('aks.detectorDiagnostics', detectorDiagnostics);
        registerCommand('aks.periscope', periscope);
        const azureAccountTreeItem = new AzureAccountTreeItem();
        context.subscriptions.push(azureAccountTreeItem);
        const treeDataProvider = new AzExtTreeDataProvider(azureAccountTreeItem, 'azureAks.loadMore');
        cloudExplorer.api.registerCloudProvider({
            cloudName: 'Azure',
            treeDataProvider,
            getKubeconfigYaml: getClusterKubeconfig
        });
        registerCommand('aks.refreshSubscription', () => {
            treeDataProvider.refresh();
        });

        FileExplorer.activateFileExplorer(context);
    } else {
        vscode.window.showWarningMessage(cloudExplorer.reason);
    }
}

async function getClusterKubeconfig(target: AksClusterTreeItem): Promise<string | undefined> {
    let user = "";

    await vscode.window.showQuickPick(["Admin", "User"], {canPickMany: false }).then( (selected: any) => {
        if (selected) {
            user = selected;
        }
    });
    return await clusters.getKubeconfigYaml(target, user === "Admin");
}