import * as vscode from 'vscode';
import { PROJECT_TYPES, ProjectType } from './repl/repl';
import * as repl from './repl/repl';

export const commands: [string, () => Promise<void>][] = [
    ["Nirvana.startRepl", startRepl],
    ["Nirvana.stopRepl", stopRepl],
    ["Nirvana.openOutput", openReplOutput]
];


async function startRepl() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders == null || workspaceFolders.length == 0) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }

    const rootPath = workspaceFolders[0].uri;
    const configUri = vscode.Uri.joinPath(rootPath, 'nirvana.json');
    vscode.window.showInformationMessage("Start repl");
    try {
        const content = await vscode.workspace.fs.readFile(configUri);
        const decodedBuffer = Buffer.from(content).toString('utf-8');
        const config = JSON.parse(decodedBuffer) as {
            "projectType": ProjectType,
            "main": string
        };
        const projectType = config.projectType;
        if (projectType == null || !PROJECT_TYPES.includes(projectType)) {
            vscode.window.showErrorMessage(`The value of the projectType in nirvana.json config file is wrong. Should be one of: ${PROJECT_TYPES}`);
            return;
        }

        const main = config.main;
        if (main == null || main.length == 0) {
            vscode.window.showErrorMessage("The value of main in nirvana.json config file is wrong. Should be the path of your project main file.");
            return;
        }

        const rs = await repl.startRepl(rootPath.fsPath, projectType, [main]);
        if (!rs[0]) {
            vscode.window.showErrorMessage(`Failed to start REPL for ${main}: ${rs[1]}`);
            return;
        }
        vscode.window.showInformationMessage(`REPL started for ${main}`);
    } catch (err: any) {
        if (err.code === 'FileNotFound') {
            vscode.window.showWarningMessage('The nirvana.json config file not found in the root folder.');
        } else {
            vscode.window.showErrorMessage('Error reading nirvana.json: ' + err.message);
        }
    }
}

async function stopRepl() {
    vscode.window.showInformationMessage("REPL stopped");
}

async function openReplOutput() {
    vscode.window.showInformationMessage("REPL output opened");
}

export function registerCommands(context: vscode.ExtensionContext) {
    commands.forEach(([command, runner]) => {
        const disposable = vscode.commands.registerCommand(command, runner);
        context.subscriptions.push(disposable);
    });
}