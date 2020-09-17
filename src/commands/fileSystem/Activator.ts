
import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import * as FileNodes from './Nodes';

export async function activateFileExplorer(context: vscode.ExtensionContext) {
    const explorer = await k8s.extension.clusterExplorer.v1;
    if (!explorer.available) {
        vscode.window.showErrorMessage(`ClusterExplorer not available.`);
        return;
    }

    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        vscode.window.showErrorMessage(`kubectl not available.`);
        return;
    }

    explorer.api.registerNodeContributor(new FileNodes.FileSystemNodeContributor(kubectl.api));
    let disposable = vscode.commands.registerCommand('k8s.pod.container.terminal', terminal);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('k8s.pod.container.file.view', viewFile);
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('k8s.pod.container.file.cp-from', fileCpFrom);
    context.subscriptions.push(disposable);
}

async function terminal(target?: any) {
    if (target && target.nodeType === 'extension') {
        if (target.impl instanceof FileNodes.ContainerNode) {
            if (vscode.window.activeTerminal) {
                const container = target.impl as FileNodes.ContainerNode;
                vscode.window.activeTerminal.sendText(`kubectl exec -it ${container.podName} -c ${container.name} --namespace ${container.namespace} -- sh`);
            }
        }
    }
}

async function viewFile(target?: any) {
    if (target && target.nodeType === 'extension') {
        if (target.impl instanceof FileNodes.FileNode) {
            if ((target.impl as FileNodes.FileNode).isFile()) {
                (target.impl as FileNodes.FileNode).viewFile();
                return;
            }
        }
    }
}

function fileCpFrom(target?: any) {
    if (target && target.nodeType === 'extension') {
        if (target.impl instanceof FileNodes.FileNode) {
            const fileNode = target.impl as FileNodes.FileNode;
            const openDialogOptions: vscode.OpenDialogOptions = {
                openLabel: 'Select the folder to cp to',
                canSelectFiles: false,
                canSelectFolders: true
            };
            vscode.window.showOpenDialog(openDialogOptions).then((selected) => {
                if (selected) {
                    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
                    terminal.show();
                    const fsPath = selected[0].fsPath;
                    if (process.platform === 'win32') {
                        terminal.sendText(`cd /D ${fsPath}`);
                    } else {
                        terminal.sendText(`cd ${fsPath}`);
                    }
                    terminal.sendText(`kubectl cp ${fileNode.namespace}/${fileNode.podName}:${fileNode.path}${fileNode.name} ${fileNode.name} -c ${fileNode.containerName}`);
                }
            });
            return;
        }
    }
}

export function deactivate() {
}