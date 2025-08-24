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
        // 确保 .vscode 目录存在
        const vscodeDir = path.dirname(typeDefsPath);
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        const typeDefinitions = buildTypeDefinitions();
        fs.writeFileSync(typeDefsPath, typeDefinitions, 'utf-8');
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
            await vscode.commands.executeCommand('typescript.reloadProjects');
        }
    } catch (error) {
        console.error('Error cleaning up type definitions:', error);
    }
}

function buildTypeDefinitions(): string {
    return `
declare global {
  interface NirvanaAppContext {
    get<T>(serviceClass: new (...args: any[]) => T): T;
  }

  const app: NirvanaAppContext;

  function get<T>(serviceClass: new (...args: any[]) => T): T;
  function repl(runner: () => void)
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
            if (!tsconfig.include.some((pattern: string) => pattern.includes('src'))) {
                tsconfig.include.unshift('**/**/*');
            }

            fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf-8');
        }
    } catch (error) {
        console.warn('Could not update tsconfig.json:', error);
    }
}