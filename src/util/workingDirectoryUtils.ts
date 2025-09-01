import vscode from 'vscode';

function defaultExclude(workingDirectory: string) {
    return new vscode.RelativePattern(workingDirectory, "**/{node_modules,dist,build,out,test}/**");
}

export async function getValidTsFileNames(workingDirectory: string): Promise<string[]> {
    const pattern = new vscode.RelativePattern(workingDirectory, "**/*.ts");
    const exclude = defaultExclude(workingDirectory);
    const files = await vscode.workspace.findFiles(pattern, exclude);
    const fileNames = files.map((file) => file.fsPath.replace(workingDirectory + "/", ""));
    return fileNames;
}

export async function getEnvFileNames(workingDirectory: string): Promise<string[]> {
    const pattern = new vscode.RelativePattern(workingDirectory, "**/*.env");
    const exclude = defaultExclude(workingDirectory);
    const files = await vscode.workspace.findFiles(pattern, exclude);
    const fileNames = files.map((file) => file.fsPath.replace(workingDirectory + "/", ""));
    return fileNames;
}