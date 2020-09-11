import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

export const KUBERNETES_FILE_VIEW = 'kubernetes-file-view';
export const KUBERNETES_FOLDER_FIND = 'kubernetes-folder-find';
export const KUBERNETES_FOLDER_LS_AL = 'kubernetes-folder-ls-al';

export class VolumeMountNode implements k8s.ClusterExplorerV1.Node {
    private volumeMount: any;

    constructor(volumeMount: any) {
        this.volumeMount = volumeMount;
    }

    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Volume mount: ' + this.volumeMount.name, vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = JSON.stringify(this.volumeMount, null, '  ');
        treeItem.contextValue = 'volumemountnode';
        return treeItem;
    }
}

export class VolumeNode implements k8s.ClusterExplorerV1.Node {
    private volume: any;

    constructor(volume: any) {
        this.volume = volume;
    }

    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Volume: ' + this.volume.name, vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = JSON.stringify(this.volume, null, '  ');
        treeItem.contextValue = 'volumenode';
        return treeItem;
    }
}

export class ContainerNode implements k8s.ClusterExplorerV1.Node {
    podName: string;
    namespace: string;
    name: string;
    public image: string;
    private initContainer: boolean;
    public volumeMounts: any;

    constructor(podName: string, namespace: string, name: string, image: string, initContainer: boolean, volumeMounts: any) {
        this.podName = podName;
        this.namespace = namespace;
        this.name = name;
        this.image = image;
        this.initContainer = initContainer;
        this.volumeMounts = volumeMounts;
    }

    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const volumeMountNodes: VolumeMountNode[] = [];
        if (this.volumeMounts && this.volumeMounts.length > 0) {
            this.volumeMounts.forEach((volumeMount: any) => {
                volumeMountNodes.push(new VolumeMountNode(volumeMount));
            });
        }
        return volumeMountNodes;
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(`${this.initContainer ? 'Init Container:' : 'Container: '} ${this.name} ( ${this.image} )`,
            (this.volumeMounts && this.volumeMounts.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None));
        treeItem.tooltip = `${this.initContainer ? 'Init Container:' : 'Container: '} ${this.name} ( ${this.image} )`;
        treeItem.contextValue = 'containernode';
        return treeItem;
    }
}

export class FolderNode implements k8s.ClusterExplorerV1.Node {
    private kubectl: k8s.KubectlV1;
    podName: string;
    namespace: string;
    containerName: string;
    path: string;
    name: string;
    volumeMounts: Array<any>;

    constructor(kubectl: k8s.KubectlV1, podName: string, namespace: string, path: string, name: string, containerName: string, volumeMounts: Array<any>) {
        this.kubectl = kubectl;
        this.podName = podName;
        this.namespace = namespace;
        this.containerName = containerName;
        this.path = path;
        this.name = name;
        this.volumeMounts = volumeMounts;
    }

    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const isWindows = true;
        const dirCommandWindows = `powershell -C "Get-ChildItem -Path ${this.path}${this.name} | %{ if($_ -is [System.IO.DirectoryInfo] )  {return $_.Name + '\\'} else {$_.Name} }"`;
        const dirCommandLinux = `ls -F ${this.path}${this.name}`;
        const dirCommand = isWindows ? dirCommandWindows : dirCommandLinux;
        const commandText = `exec -it ${this.podName} ${this.containerName ? '-c ' + this.containerName : ''} --namespace ${this.namespace} -- ${dirCommand}`;
        const lsResult = await this.kubectl.invokeCommand(commandText);

        if (!lsResult || lsResult.code !== 0) {
            vscode.window.showErrorMessage(`Can't get resource usage: ${lsResult ? lsResult.stderr : 'unable to run kubectl'}`);
            return [];
        }
        const lsCommandOutput = lsResult.stdout;
        if (lsCommandOutput.trim().length > 0) {
            const fileNames = lsCommandOutput.split('\n').filter((fileName) => fileName && fileName.trim().length > 0);
            return fileNames.map((fileName) => {
                fileName = fileName.replace('\r', '');
                if (fileName.endsWith('/') || fileName.endsWith('\\')) {
                    return new FolderNode(this.kubectl, this.podName, this.namespace, this.path + this.name, fileName, this.containerName, this.volumeMounts);
                } else {
                    return new FileNode(this.podName, this.namespace, this.path + this.name, fileName, this.containerName, this.volumeMounts);
                }
            });
        }
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        let label = this.name.trim().length > 0 ? this.name : (this.containerName ? this.containerName + ':' : '') + this.path;
        if (this.volumeMounts.indexOf(`${this.path}${this.name.substring(0, this.name.length - 1)}`) !== -1) {
            label += ` [Mounted]`;
        }
        const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.tooltip = label;
        treeItem.iconPath = vscode.ThemeIcon.Folder;
        treeItem.contextValue = 'containerfoldernode';
        return treeItem;
    }

    async findImpl(findArgs: any) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(`${KUBERNETES_FOLDER_FIND}:${this.podName}:${this.namespace}:${this.containerName}:${this.path}${this.name}`));
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    find() {
        const findArgs = '';
        this.findImpl(findArgs);
    }

    async lsDashAl() {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(`${KUBERNETES_FOLDER_LS_AL}:${this.podName}:${this.namespace}:${this.containerName}:${this.path}${this.name}`));
        await vscode.window.showTextDocument(doc, { preview: false });
    }
}

export class FileNode implements k8s.ClusterExplorerV1.Node {
    podName: string;
    namespace: string;
    containerName: string;
    path: string;
    name: string;
    volumeMounts: Array<any>;

    constructor(podName: string, namespace: string, path: string, name: string, containerName: string, volumeMounts: Array<any>) {
        this.podName = podName;
        this.namespace = namespace;
        this.containerName = containerName;
        this.path = path;
        this.name = name
            .replace(/\@$/, '')
            .replace(/\*$/, '');
        this.volumeMounts = volumeMounts;
    }

    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        let label = this.name;
        if (this.volumeMounts.indexOf(`${this.path}${this.name}`) !== -1) {
            label += ` [Mounted]`;
        }
        const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.path + label;
        treeItem.contextValue = 'containerfilenode';
        return treeItem;
    }

    isFile() {
        return true;
    }

    async viewFile() {
        await this.readFile();
    }

    async readFile() {
        const kubectl = await k8s.extension.kubectl.v1;
        let text: string | undefined = '';
        if (kubectl.available) {
            const shell: k8s.KubectlV1.ShellResult | undefined = await kubectl.api.invokeCommand(`exec -it --namespace ${this.namespace} -c ${this.containerName} ${this.podName} -- powershell -C type ${this.path}${this.name}`);
            if (shell?.code !== 0) {
                vscode.window.showErrorMessage(`Can't get data: ${shell ? shell.stderr : 'unable to read file ${this.path}${this.name}'}`);
            }
            text = shell?.stdout;
        }
        const doc = await vscode.workspace.openTextDocument({content: text});
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    tailDashFFile() {
        const terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
        terminal.show();
        terminal.sendText(`kubectl exec -it --namespace ${this.namespace} -c ${this.containerName} ${this.podName} -- powershell -C type ${this.path}${this.name}`);
    }
}

export class FileSystemNodeContributor {
    private kubectl: k8s.KubectlV1;

    constructor(kubectl: k8s.KubectlV1) {
        this.kubectl = kubectl;
    }

    contributesChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode): boolean {
        return parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'Pod';
    }

    async getChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<k8s.ClusterExplorerV1.Node[]> {
        if (parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'Pod') {
            const namespace: string = parent.namespace ?? 'default';
            const explorer = await k8s.extension.clusterExplorer.v1;
            if (explorer.available) {
                const kubectl = await k8s.extension.kubectl.v1;
                if (kubectl.available) {
                    const podDetails = await kubectl.api.invokeCommand(`get pods ${parent.name} -o json`);
                    if (podDetails && podDetails.stdout) {
                        const podDetailsAsJson = JSON.parse(podDetails.stdout);
                        const volumes: VolumeNode[] = [];
                        podDetailsAsJson.spec.volumes.forEach((volume: VolumeNode) => {
                            volumes.push(new VolumeNode(volume));
                        });
                        const containers: ContainerNode[] = [];
                        podDetailsAsJson.spec.containers.forEach((container: ContainerNode) => {
                            containers.push(new ContainerNode(parent.name, namespace, container.name, container.image, false, container.volumeMounts));
                        });
                        const containerFilesystems: FolderNode[] = [];
                        podDetailsAsJson.spec.containers.forEach((container: ContainerNode) => {
                            const volumeMounts: Array<any> = [];
                            if (container.volumeMounts && container.volumeMounts.length > 0) {
                                container.volumeMounts.forEach((volumeMount: any) => {
                                    volumeMounts.push(volumeMount.mountPath);
                                });
                            }
                            containerFilesystems.push(new FolderNode(this.kubectl, parent.name, namespace, 'C:\\', '', container.name, volumeMounts));
                        });
                        return [...volumes, ...containers, ...containerFilesystems];
                    }
                }
            }
        }
        return [];
    }
}

export class KubernetesContainerFileDocumentProvider implements vscode.TextDocumentContentProvider {
    private kubectl: k8s.KubectlV1;

    constructor(kubectl: k8s.KubectlV1) {
        this.kubectl = kubectl;
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const parts = uri.path.split(':');

        let command;
        if (uri.scheme === KUBERNETES_FILE_VIEW) {
            command = 'type';
        } else if (uri.scheme === KUBERNETES_FOLDER_FIND) {
            command = 'find';
        } else if (uri.scheme === KUBERNETES_FOLDER_LS_AL) {
            command = 'ls -al';
        }
        if (command) {
            const result: k8s.KubectlV1.ShellResult | undefined = await this.kubectl.invokeCommand(`exec -it ${parts[0]}  -c ${parts[2]} --namespace ${parts[1]} -- ${command} ${parts[3]}`);
            if (result?.code !== 0) {
                vscode.window.showErrorMessage(`Can't get data: ${result ? result.stderr : 'unable to run cat command on file ${this.path}${this.name}'}`);
                return `${command} ${uri.path}\n ${result?.stderr}`;
            }
            let output = (uri.scheme === KUBERNETES_FILE_VIEW) ? '' : `${command} ${parts[3]}\n\n`;
            output += result.stdout;
            if (output) {
                return output;
            }
        }
        return uri.toString();
    }
}