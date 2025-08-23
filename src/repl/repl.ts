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

async function startNestJsRepl(workingspacePath: string, mainFilePath: string, maxReplWaitTime: number): Promise<[boolean, string | undefined]> {
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

        // Set up basic output logging
        const outputHandler = (data: any) => {
            outputChannel.appendLine(data.toString().trim());
        };
        repl.stdout.on('data', outputHandler);
        repl.stderr.on('data', outputHandler);
        repl.on('close', (code) => {
            outputChannel.appendLine(`\nREPL process exited with code ${code}`);
            repl = null;
        });

        outputChannel.appendLine("Waiting for REPL to be ready...");
        const isReady = await waitForReplReady(maxReplWaitTime);

        if (!isReady) {
            outputChannel.appendLine("❌ REPL failed to become ready");
            return [false, "REPL failed to initialize properly"];
        }

        outputChannel.appendLine("✅ REPL is ready!");
        return [true, undefined];
    } catch (err: any) {
        outputChannel.appendLine(`❌ Error on starting repl: ${err.message}`);
        vscode.window.showErrorMessage(`Error on starting repl: ${err.message}`);
        return [false, err.message];
    }
}

export async function startRepl(wsPath: string, projectType: ProjectType, filesToLoad: string[], maxReplWaitTime: number = 15000): Promise<[boolean, string | undefined]> {
    let suc = false;
    let err: string | undefined = `Unsupported project type ${projectType}`;
    if (projectType == "nestJs") {
        vscode.window.showInformationMessage("Starting nestJs REPL...");
        const [nestTsSuc, nestTsErr] = await startNestJsRepl(wsPath, filesToLoad[0], maxReplWaitTime);
        suc = nestTsSuc;
        err = nestTsErr;
    }

    return [suc, err];
}

export function stopRepl() {
    if (repl) {
        outputChannel.appendLine("🛑 Stopping REPL...");
        repl.kill('SIGTERM');
        repl = null;
        outputChannel.appendLine("✅ REPL stopped");
    } else {
        outputChannel.appendLine("ℹ️ No REPL running to stop");
    }
}

export async function replEval(code: string, timeoutMs: number = 5000): Promise<string> {
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
            outputChannel.append(`STDERR: ${errorOutput}`);
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

async function waitForReplReady(maxWaitTime: number = 15000): Promise<boolean> {
    if (!repl) {
        outputChannel.appendLine("❌ REPL process not initialized");
        return false;
    }

    const startTime = Date.now();
    const retryInterval = 2000; // Try every 2 seconds

    outputChannel.appendLine("🔍 Testing REPL readiness...");

    while (Date.now() - startTime < maxWaitTime) {
        try {
            const result = await replEval('console.log("REPL READY")', 3000);
            if (result && result.includes("REPL READY")) {
                outputChannel.appendLine("✅ REPL is ready!");
                return true;
            }
        } catch (error: any) {
            // REPL not ready yet, continue trying
            outputChannel.appendLine(`⏳ REPL not ready yet, retrying... (${error.message})`);
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    // Timeout reached
    outputChannel.appendLine("❌ REPL ready check timed out");
    return false;
}