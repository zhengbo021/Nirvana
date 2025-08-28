import * as vscode from 'vscode';
import { ProjectType } from './repl/repl';
import * as repl from './repl/repl';
import * as nestJsTypeGenerator from './repl/typeDefinitionGenerator'
import * as nirvanaOutput from './nirvanaOutput'
import { showConfigurationOptions, getAutoImportDependencies, getAutoImportCurrentFile } from './configuration';
import { getExecutableCode, highlightExecutableCode } from './utils/codeSelector'
import { showInlineResult, showInlineError, getCodeExecutionRange, clearInlineResults, clearAllInlineResults } from './utils/inlineResults'
import { analyzeDependencies, convertToReplImports } from './utils/dependencyAnalyzer'

/**
 * 生成当前文件的导入语句，确保方法可用且是最新版本
 */
function generateCurrentFileImport(currentFilePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return '';
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    let relativePath = currentFilePath.replace(workspaceRoot, '');

    // 确保路径以 ./ 开头，并移除文件扩展名
    if (relativePath.startsWith('/')) {
        relativePath = '.' + relativePath;
    }
    relativePath = relativePath.replace(/\.(ts|js)$/, '');

    // 生成递归缓存清理代码
    const cacheClearing = `
(function clearModuleCache(moduleName) {
    try {
        const resolvedPath = require.resolve(moduleName);
        const module = require.cache[resolvedPath];
        if (module && module.children) {
            module.children.forEach(child => {
                if (child.filename && child.filename.includes(process.cwd()) && 
                    !child.filename.includes('node_modules')) {
                    delete require.cache[child.filename];
                }
            });
        }
        delete require.cache[resolvedPath];
    } catch (e) {
    }
})('${relativePath}');`.trim();

    const importStatement = `const __currentFile = require('${relativePath}'); Object.keys(__currentFile).forEach(key => { if (key !== 'default') global[key] = __currentFile[key]; });`;

    return `${cacheClearing}\n${importStatement}\n`;
}

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

    // 保存用户按下 Ctrl+Enter 时的光标位置
    const cursorPosition = editor.selection.active;

    try {
        const codeToExecute = await getExecutableCode(editor);

        if (!codeToExecute || codeToExecute.trim().length === 0) {
            vscode.window.showWarningMessage('No code found to execute');
            return;
        }

        const executionRange = getCodeExecutionRange(editor, codeToExecute, cursorPosition);
        highlightExecutableCode(editor, codeToExecute, cursorPosition, executionRange || undefined);

        // 构建最终执行的代码
        let finalCode = codeToExecute;
        let hasDynamicImports = false;
        let importInfo = '';

        let importStatements = ""
        // 检查是否启用了自动导入功能
        if (getAutoImportDependencies()) {
            // 分析依赖并生成导入语句
            const dependencyAnalysis = await analyzeDependencies(editor.document, codeToExecute);
            importStatements = convertToReplImports(dependencyAnalysis.requiresImports, editor.document.uri.fsPath);

            if (dependencyAnalysis.requiresImports.length > 0) {
                importInfo = dependencyAnalysis.requiresImports.map(i => i.moduleName).join(', ');
            }
        }

        // 自动导入当前文件以确保方法可用且是最新版本
        if (getAutoImportCurrentFile()) {
            const currentFileImport = generateCurrentFileImport(editor.document.uri.fsPath);
            if (currentFileImport) {
                importStatements = currentFileImport + importStatements;
                hasDynamicImports = true;
                importInfo = importInfo ? `current file, ${importInfo}` : 'current file';
            }
        }

        if (importStatements.trim().length > 0) {
            hasDynamicImports = true;

            // 检查是否导入了可能有副作用的本地模块
            const localImports = importInfo.includes('current file') || importInfo.includes('./') || importInfo.includes('../');

            nirvanaOutput.appendLine(`📦 Auto-importing dependencies: ${importInfo}`);

            if (localImports) {
                nirvanaOutput.appendLine(`⚠️  Warning: Importing local modules may execute initialization code`);
                nirvanaOutput.appendLine(`   If you see unexpected output, consider separating export definitions from execution logic`);
            }

            nirvanaOutput.appendLine(`🔗 Generated imports:\n${importStatements}`);
        }

        nirvanaOutput.appendLine(`finalCode: ${finalCode} \nimportStatment: ${importStatements}`)
        const result = await repl.replEval(finalCode, importStatements);
        nirvanaOutput.appendLine(`Result: ${result}, execution range: ${JSON.stringify(executionRange)}`);

        if (executionRange) {
            showInlineResult(editor, executionRange, result, cursorPosition);
        }

        if (result) {
            nirvanaOutput.appendLine(`> ${codeToExecute}`);
            if (hasDynamicImports) {
                nirvanaOutput.appendLine(`📦 With auto-imports for: ${importInfo}`);
            }
            nirvanaOutput.appendLine(result);
        }
    } catch (error: any) {
        const codeToExecute = await getExecutableCode(editor);
        const executionRange = codeToExecute ? getCodeExecutionRange(editor, codeToExecute, cursorPosition) : null;

        if (executionRange) {
            showInlineError(editor, executionRange, error.message || error.toString(), cursorPosition);
        }

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