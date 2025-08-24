import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { appendLine } from '../nirvanaOutput'
import * as dotenv from 'dotenv'

export const PROJECT_TYPES = ["nestJs", "typescript", "javascript"] as const;
export type ProjectType = typeof PROJECT_TYPES[number];

let repl: null | ChildProcessWithoutNullStreams = null;
async function readEnv(envFilePath: string | undefined): Promise<[boolean, Record<string, string>]> {
    if (envFilePath == null) {
        return [true, {}]
    }
    let env: Record<string, string> = {};
    try {
        const file = await vscode.workspace.openTextDocument(envFilePath);
        const envContent = file.getText();
        env = dotenv.parse(envContent);
    } catch (e) {
        appendLine(`⚠️ Failed to load env file: ${e}`);
        return [false, {}]
    }
    return [true, env];
}

async function startNestJsRepl(workingspacePath: string, mainFilePath: string, maxReplWaitTime: number, envFilePath: string | undefined): Promise<[boolean, string | undefined]> {
    appendLine("Starting REPL process...");

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
        const [suc, extraEnv] = await readEnv(envFilePath);
        if (!suc) {
            return [false, `Failed to load env file ${envFilePath}`];
        }
        appendLine(`Using env file: ${envFilePath} and the following environment variables:`);
        for (const [key, value] of Object.entries(extraEnv)) {
            appendLine(`${key}=${value}`);
        }

        repl = spawn(command, args, {
            cwd: workingspacePath,
            env: { ...process.env, NODE_PATH: `${workingspacePath}/node_modules`, ...extraEnv },
            stdio: 'pipe'
        });

        const outputHandler = (data: any) => {
            appendLine(data.toString().trim());
        };
        repl.stdout.on('data', outputHandler);
        repl.stderr.on('data', outputHandler);
        repl.on('close', (code) => {
            appendLine(`\nREPL process exited with code ${code}`);
            repl = null;
        });

        appendLine("Waiting for REPL to be ready...");
        const isReady = await waitForReplReady(maxReplWaitTime);

        if (!isReady) {
            appendLine("❌ REPL failed to become ready");
            return [false, "REPL failed to initialize properly"];
        }

        appendLine("✅ REPL is ready!");
        return [true, undefined];
    } catch (err: any) {
        appendLine(`❌ Error on starting repl: ${err.message}`);
        vscode.window.showErrorMessage(`Error on starting repl: ${err.message}`);
        return [false, err.message];
    }
}

export async function startRepl(wsPath: string, projectType: ProjectType, filesToLoad: string[], envFilePath: string | undefined = undefined, maxReplWaitTime: number = 15000): Promise<[boolean, string | undefined]> {
    let suc = false;
    let err: string | undefined = `Unsupported project type ${projectType}`;
    if (projectType == "nestJs") {
        vscode.window.showInformationMessage("Starting nestJs REPL...");
        [suc, err] = await startNestJsRepl(wsPath, filesToLoad[0], maxReplWaitTime, envFilePath);
    }
    return [suc, err];
}

export function stopRepl() {
    if (repl) {
        appendLine("🛑 Stopping REPL...");
        repl.kill('SIGTERM');
        repl = null;
        appendLine("✅ REPL stopped");
    } else {
        appendLine("ℹ️ No running REPL to stop");
    }
}

export function isReplRunning(): boolean {
    return repl !== null && !repl.killed;
}

export async function replEval(code: string, timeoutMs: number = 5000): Promise<string> {
    //make the code as one line
    code = code.replace(/\n/g, ' ');
    if (!repl) {
        appendLine("ℹ️ No running REPL to evaluate code.");
        throw new Error("REPL is not running.");
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
            appendLine(`STDERR: ${errorOutput}`);
        };

        const onClose = () => {
            appendLine(`repl on close......`);
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

        appendLine(`\n📤 Sending to REPL: ${code}`);
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
        appendLine("❌ REPL process not initialized");
        return false;
    }

    const startTime = Date.now();
    const retryInterval = 2000; // Try every 2 seconds

    appendLine("🔍 Testing REPL readiness...");

    while (Date.now() - startTime < maxWaitTime) {
        try {
            const result = await replEval('console.log("REPL READY")', 3000);
            if (result && result.includes("REPL READY")) {
                appendLine("✅ REPL is ready!");
                return true;
            }
        } catch (error: any) {
            // REPL not ready yet, continue trying
            appendLine(`⏳ REPL not ready yet, retrying... (${error.message})`);
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    // Timeout reached
    appendLine("❌ REPL ready check timed out");
    return false;
}