import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import path from "path";
import * as vscode from 'vscode';

export const PROJECT_TYPES = ["nestJs", "typescript", "javascript"] as const;
export type ProjectType = typeof PROJECT_TYPES[number]
var repl: null | ChildProcessWithoutNullStreams = null;
let outputChannel: vscode.OutputChannel;

function createOutputChannel() {
    outputChannel = vscode.window.createOutputChannel("Nirvana REPL");
}

async function startNestJsRepl(workingspacePath: string, mainFilePath: string): Promise<[boolean, string | undefined]> {
    createOutputChannel();
    outputChannel.show(true);
    outputChannel.appendLine("Starting REPL process...");

    try {
        const replStarterPath = path.join(__dirname, 'nestJsReplStarter.js');
        const command = 'node';
        const args = [
            '-i',
            '-r', 'ts-node/register',
            '-r', 'tsconfig-paths/register',
            replStarterPath,
            mainFilePath
        ];

        repl = spawn(command, args, {
            cwd: workingspacePath,
            env: { ...process.env, NODE_PATH: `${workingspacePath}/node_modules` },
            stdio: 'pipe'
        });
        const printToOutput = (data: any) => {
            outputChannel.appendLine(data);
        };
        repl.stdout.on('data', printToOutput);
        repl.stderr.on('data', printToOutput);
        repl.on('close', (code) => {
            outputChannel.appendLine(`\nREPL process exited with code ${code}`);
            repl = null;
        });

        outputChannel.appendLine("Waiting for REPL to be ready...");
        await waitForReplReady();
        repl.stdout.removeAllListeners();
        repl.stderr.removeAllListeners();
        outputChannel.appendLine("✅ REPL is ready!");
        return [true, undefined];
    } catch (err: any) {
        outputChannel.appendLine(`❌ Error on starting repl: ${err.message}`);
        vscode.window.showErrorMessage(`Error on starting repl: ${err.message}`);
        return [false, err.message];
    }
}

export async function startRepl(wsPath: string, projectType: ProjectType, filesToLoad: string[]): Promise<[boolean, string | undefined]> {
    let suc = false;
    let err: string | undefined = `Unsupported project type ${projectType}`;
    if (projectType == "nestJs") {
        vscode.window.showInformationMessage("Starting nestJs REPL...");
        const [nestTsSuc, nestTsErr] = await startNestJsRepl(wsPath, filesToLoad[0]);
        suc = nestTsSuc;
        err = nestTsErr;
    }

    return [suc, err];
}

export function stopRepl() {

}

export async function replEval(code: string, timeoutMs: number = 10000): Promise<string> {
    if (!repl) {
        vscode.window.showErrorMessage('REPL is not running.');
        return "Error: REPL is not running.";
    }

    return new Promise((resolve, reject) => {
        let output = '';
        let isResolved = false;

        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                reject(new Error(`REPL evaluation timed out. Output: ${output}`));
            }
        }, timeoutMs);

        const cleanup = () => {
            repl?.stdout.removeListener('data', onData);
            repl?.stderr.removeListener('data', onErrorData);
            repl?.removeListener('close', onClose);
            repl?.removeListener('error', onError);
        };

        const onData = (data: Buffer) => {
            const chunk = data.toString();
            output += chunk;
            const cleanOutput = extractResult(output);
            const isComplete = cleanOutput.length != 0;
            if (isComplete && !isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                repl?.stdout.removeListener('data', onData);
                repl?.stderr.removeListener('data', onErrorData);
                resolve(cleanOutput);
            }
        };

        const onErrorData = (data: Buffer) => {
            const errorOutput = data.toString();
            output += errorOutput;
            // outputChannel.append(`STDERR: ${errorOutput}`);
        };

        const onClose = () => {
            outputChannel.appendLine(`repl on close......`);
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                cleanup();
                reject(new Error('REPL process closed'));
            }
        };

        const onError = (error: Error) => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                cleanup();
                reject(error);
            }
        };

        if (repl == null) {
            reject("Repl is null");
            return;
        }

        repl.stdout.on('data', onData);
        repl.stderr.on('data', onErrorData);
        repl.on('close', onClose);
        repl.on('error', onError);

        outputChannel.appendLine(`\n📤 Sending to REPL: ${code}`);
        repl.stdin.write(code + '\n');
    });
}

function extractResult(rawOutput: string): string {
    let clean = rawOutput.replace(/\x1b\[[0-9;]*m/g, '');
    const rs = clean.replace(/>\s*/g, '').trim();
    return rs;
}

function waitForReplReady(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!repl) {
            reject("REPL process not initialized.");
            return;
        }

        const onData = (data: Buffer) => {
            const output = data.toString();
            // Check for the NestJS REPL prompt
            if (output.includes("REPL initialize")) {
                repl?.stdout.removeListener('data', onData);
                resolve();
            }
        };

        const onError = (err: Error) => {
            repl?.stderr.removeListener('data', onData);
            repl?.stderr.removeListener('error', onError);
            reject(err);
        };

        repl.stdout.on('data', onData);
        repl.stderr.on('data', onData);
        repl.stderr.on('error', onError);
    });
}