import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectType } from './repl';

function buildTypeDefsPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, '.vscode', 'nirvana-types.d.ts');
}

export async function generateTypeDefinitions(workspaceRoot: string, projectType: ProjectType): Promise<void> {
    if (projectType != "nestJs") {
        return;
    }

    const typeDefsPath = buildTypeDefsPath(workspaceRoot);
    try {
        const vscodeDir = path.dirname(typeDefsPath);
        const vscodeDirUri = vscode.Uri.file(vscodeDir);
        const folderExists = await vscode.workspace.fs.stat(vscodeDirUri).then(() => true, () => false);
        if (!folderExists) {
            await vscode.workspace.fs.createDirectory(vscodeDirUri);
        }

        const typeDefinitions = buildTypeDefinitions();
        await vscode.workspace.fs.writeFile(vscode.Uri.file(typeDefsPath), Buffer.from(typeDefinitions, 'utf-8'));
        await ensureTypeScriptConfiguration(workspaceRoot);
    } catch (error) {
        console.error('Error generating type definitions:', error);
    }
}

export async function cleanup(workspaceRoot: string) {
    const typeDefsPath = buildTypeDefsPath(workspaceRoot);
    try {
        if (fs.existsSync(typeDefsPath)) {
            fs.unlinkSync(typeDefsPath);
        }
    } catch (error) {
        console.error('Error cleaning up type definitions:', error);
    }
}

function buildTypeDefinitions(): string {
    return `
declare global {
  function get<T>(serviceClass: new (...args: any[]) => T): T;
  function comment(runner: () => void)
}

export {};`
}

async function ensureTypeScriptConfiguration(workspaceRoot: string) {
    const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');

    if (!fs.existsSync(tsconfigPath)) {
        return;
    }

    try {
        const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);

        // 确保包含我们的类型定义文件
        if (!tsconfig.include) {
            tsconfig.include = ['**/**/*'];
        }

        const typeDefInclude = '.vscode/nirvana-types.d.ts';
        if (!tsconfig.include.includes(typeDefInclude)) {
            tsconfig.include.push(typeDefInclude);

            // 确保也包含了源代码文件
            if (!tsconfig.include.some((pattern: string) => pattern.includes('**/**'))) {
                tsconfig.include.unshift('**/**/*');
            }

            fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf-8');
        }
    } catch (error) {
        console.warn('Could not update tsconfig.json:', error);
    }
}