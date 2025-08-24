import * as vscode from 'vscode';
import { ProjectType } from './repl/repl';
import * as repl from './repl/repl';
import * as nestJsTypeGenerator from './repl/typeDefinitionGenerator'
import * as nirvanaOutput from './nirvanaOutput'
import { showConfigurationOptions } from './configuration';
import { getExecutableCode, highlightExecutableCode } from './utils/codeSelector'
export const commands: [string, () => Promise<void>][] = [
    ["Nirvana.startRepl", startRepl],
    ["Nirvana.stopRepl", stopRepl],
    ["Nirvana.openOutput", openReplOutput],
    ["Nirvana.executeCode", executeCode],
    ["Nirvana.configuration", showConfigurationOptions]
];

async function showProjectTypeOptions(): Promise<ProjectType> {
    const options: [ProjectType, ProjectType, ProjectType] = ["nestJs", "typescript", "javascript"];
    const selection = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select a project type',
    });
    return selection as ProjectType;
}

async function askUserMainFile(projectType: ProjectType): Promise<string> {
    const files = await vscode.workspace.findFiles(
        projectType === "javascript" ? '**/*.js' : '**/*.ts',
        '{**/node_modules/**,**/dist/**,**/out/**}'
    );
    if (files.length === 0) {
        vscode.window.showWarningMessage('No matching files found in workspace.');
        return '';
    }
    const items = files.map(f => ({
        label: vscode.workspace.asRelativePath(f),
        uri: f
    }));
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select the main entry file for your project'
    });
    return picked ? picked.uri.fsPath : '';
}

async function askUserToChoseEnvFile(): Promise<string | "None"> {
    const files = await vscode.workspace.findFiles('**/.env*', '**/node_modules/**');
    const items = files.map(f => ({
        label: vscode.workspace.asRelativePath(f),
        uri: f
    }));

    // Add "None" option at the top
    items.unshift({
        label: 'None',
        uri: {
            fsPath: "None"
        }
    } as any);

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select the .env file for your project'
    });
    if (picked && picked.label == "None") {
        return "None";
    }

    return picked && picked.uri ? picked.uri.fsPath : '';
}

async function startRepl() {
    nirvanaOutput.show();
    const projectType = await showProjectTypeOptions();
    if (projectType == null || projectType.length == 0) {
        vscode.window.showWarningMessage('No project type selected.');
        return;
    }

    const mainFile = await askUserMainFile(projectType);
    if (mainFile == null || mainFile.length == 0) {
        vscode.window.showWarningMessage('No main file selected.');
        return;
    }

    const envFile = await askUserToChoseEnvFile();
    if (envFile == null || envFile.length == 0) {
        vscode.window.showWarningMessage('No .env file selected');
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders == null || workspaceFolders.length == 0) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }

    const rootPath = workspaceFolders[0].uri;
    try {
        await nestJsTypeGenerator.generateTypeDefinitions(rootPath.fsPath, projectType);
        const rs = await repl.startRepl(rootPath.fsPath, projectType, [mainFile], envFile == "None" ? undefined : envFile);
        if (!rs[0]) {
            vscode.window.showErrorMessage(`Failed to start REPL for ${mainFile}: ${rs[1]}`);
            return;
        }
        vscode.window.showInformationMessage(`REPL started for ${mainFile}`);
    } catch (err: any) {
        if (err.code === 'FileNotFound') {
            vscode.window.showWarningMessage('The nirvana.json config file not found in the root folder.');
        } else {
            vscode.window.showErrorMessage('Error reading nirvana.json: ' + err.message);
        }
    }
}

async function stopRepl() {
    repl.stopRepl();
    vscode.window.showInformationMessage("REPL stopped");
}

async function openReplOutput() {
    vscode.window.showInformationMessage("REPL output opened");
}

async function executeCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    if (!repl.isReplRunning()) {
        vscode.window.showWarningMessage('REPL is not running. Please start the REPL first.');
        return;
    }

    try {
        const codeToExecute = await getExecutableCode(editor);

        if (!codeToExecute || codeToExecute.trim().length === 0) {
            vscode.window.showWarningMessage('No code found to execute');
            return;
        }

        highlightExecutableCode(editor, codeToExecute);

        nirvanaOutput.show();
        const result = await repl.replEval(codeToExecute);
        if (result) {
            nirvanaOutput.appendLine(result);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to execute code: ${error}`);
        nirvanaOutput.appendLine(`Error: ${error}`);
    }
}

export function registerCommands(context: vscode.ExtensionContext) {
    commands.forEach(([command, runner]) => {
        const disposable = vscode.commands.registerCommand(command, runner);
        context.subscriptions.push(disposable);
    });
}