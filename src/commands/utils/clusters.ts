import * as vscode from 'vscode';
import AksClusterTreeItem from "../../tree/aksClusterTreeItem";
import { parseResource } from "../../azure-api-utils";
import * as azcs from 'azure-arm-containerservice';  // deprecated, but @azure/arm-containerservice doesn't play nicely with AzureAccount, so...

export async function getKubeconfigYaml(target: AksClusterTreeItem, isAdmin: boolean): Promise<string | undefined> {
    const { resourceGroupName, name } = parseResource(target.id!);
    if (!resourceGroupName || !name) {
        vscode.window.showErrorMessage(`Invalid ARM id ${target.id}`);
        return undefined;
    }
    const client = new azcs.ContainerServiceClient(target.root.credentials, target.root.subscriptionId);  // TODO: safely
    try {
        let clusterCredentials: azcs.ContainerServiceModels.CredentialResults | undefined = undefined;
        let username = "";
        if (isAdmin) {
            clusterCredentials = await client.managedClusters.listClusterAdminCredentials(resourceGroupName, name);
            username = "clusterAdmin";
        } else {
            clusterCredentials = await client.managedClusters.listClusterUserCredentials(resourceGroupName, name);
            username = "clusterUser";
        }
        const kubeconfigCredResult = clusterCredentials.kubeconfigs!.find((kubeInfo) => kubeInfo.name === username);
        const kubeconfig = kubeconfigCredResult?.value?.toString();
        return kubeconfig;
    } catch (e) {
        vscode.window.showErrorMessage(`Can't get kubeconfig: ${e}`);
        return undefined;
    }
}