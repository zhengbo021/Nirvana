import * as ts from 'typescript';
import * as vscode from 'vscode';

export interface ImportInfo {
    moduleName: string;
    importType: 'default' | 'named' | 'namespace' | 'require' | 'dynamic';
    importedNames: string[];
    alias?: string;
    originalStatement: string;
}

export interface DependencyAnalysisResult {
    imports: ImportInfo[];
    usedVariables: Set<string>;
    requiresImports: ImportInfo[];
}

export async function analyzeDependencies(
    document: vscode.TextDocument,
    codeToExecute: string
): Promise<DependencyAnalysisResult> {
    const sourceCode = document.getText();
    const usedVariables = extractUsedVariables(codeToExecute);
    const allImports = extractAllImports(sourceCode);

    const requiresImports = allImports.filter(imp =>
        imp.importedNames.some(name => usedVariables.has(name)) ||
        (imp.alias && usedVariables.has(imp.alias))
    );

    return {
        imports: allImports,
        usedVariables,
        requiresImports
    };
}

function extractUsedVariables(code: string): Set<string> {
    const usedVariables = new Set<string>();

    try {
        const sourceFile = ts.createSourceFile(
            'temp.ts',
            code,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS
        );

        function visit(node: ts.Node) {
            if (ts.isIdentifier(node)) {
                const parent = node.parent;
                if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
                    return;
                }

                if (ts.isPropertyAssignment(parent) && parent.name === node) {
                    return;
                }

                usedVariables.add(node.text);
            }

            ts.forEachChild(node, visit);
        }

        visit(sourceFile);
    } catch (error) {
        console.error('Failed to extract used variables:', error);
    }

    return usedVariables;
}

function extractAllImports(sourceCode: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    try {
        const sourceFile = ts.createSourceFile(
            'temp.ts',
            sourceCode,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS
        );

        function visit(node: ts.Node) {
            // 首先检测动态导入（可能在任何位置）
            if (ts.isVariableStatement(node)) {
                node.declarationList.declarations.forEach(declaration => {
                    // 检测 await import() 形式的动态导入
                    if (declaration.initializer && ts.isAwaitExpression(declaration.initializer)) {
                        const awaitExpr = declaration.initializer;
                        if (ts.isCallExpression(awaitExpr.expression)) {
                            const callExpr = awaitExpr.expression;
                            // 检查是否是 import() 调用 - expression 应该是 ImportKeyword，不是 Identifier
                            if (callExpr.expression.kind === ts.SyntaxKind.ImportKeyword &&
                                callExpr.arguments.length > 0) {
                                const arg = callExpr.arguments[0];
                                if (ts.isStringLiteral(arg)) {
                                    const moduleName = arg.text;
                                    let importedNames: string[] = [];

                                    if (ts.isIdentifier(declaration.name)) {
                                        // const module = await import('./utils')
                                        importedNames.push(declaration.name.text);
                                    } else if (ts.isObjectBindingPattern(declaration.name)) {
                                        // const { testUtils } = await import('./utils')
                                        declaration.name.elements.forEach(element => {
                                            if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                                                importedNames.push(element.name.text);
                                            }
                                        });
                                    }

                                    imports.push({
                                        moduleName,
                                        importType: 'dynamic',
                                        importedNames,
                                        originalStatement: sourceCode.substring(node.getStart(), node.getEnd())
                                    });
                                }
                            }
                        }
                    }

                    // 原有的 require 语句检测
                    if (declaration.initializer && ts.isCallExpression(declaration.initializer)) {
                        const callExpr = declaration.initializer;
                        if (ts.isIdentifier(callExpr.expression) &&
                            callExpr.expression.text === 'require' &&
                            callExpr.arguments.length > 0) {
                            const arg = callExpr.arguments[0];
                            if (ts.isStringLiteral(arg)) {
                                const moduleName = arg.text;
                                let importedNames: string[] = [];

                                if (ts.isIdentifier(declaration.name)) {
                                    // const fs = require('fs')
                                    importedNames.push(declaration.name.text);
                                } else if (ts.isObjectBindingPattern(declaration.name)) {
                                    // const { readFile, writeFile } = require('fs')
                                    declaration.name.elements.forEach(element => {
                                        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                                            importedNames.push(element.name.text);
                                        }
                                    });
                                }

                                imports.push({
                                    moduleName,
                                    importType: 'require',
                                    importedNames,
                                    originalStatement: sourceCode.substring(node.getStart(), node.getEnd())
                                });
                            }
                        }
                    }
                });
            }

            // ES6 import 语句
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier;
                if (ts.isStringLiteral(moduleSpecifier)) {
                    const moduleName = moduleSpecifier.text;
                    const importClause = node.importClause;

                    if (importClause) {
                        const importInfo: ImportInfo = {
                            moduleName,
                            importType: 'named',
                            importedNames: [],
                            originalStatement: sourceCode.substring(node.getStart(), node.getEnd())
                        };

                        // 默认导入
                        if (importClause.name) {
                            importInfo.importType = 'default';
                            importInfo.importedNames.push(importClause.name.text);
                            importInfo.alias = importClause.name.text;
                        }

                        // 命名导入
                        if (importClause.namedBindings) {
                            if (ts.isNamespaceImport(importClause.namedBindings)) {
                                // import * as name from 'module'
                                importInfo.importType = 'namespace';
                                importInfo.alias = importClause.namedBindings.name.text;
                                importInfo.importedNames.push(importClause.namedBindings.name.text);
                            } else if (ts.isNamedImports(importClause.namedBindings)) {
                                // import { a, b as c } from 'module'
                                importClause.namedBindings.elements.forEach(element => {
                                    const name = element.name.text;
                                    const propertyName = element.propertyName?.text || name;
                                    importInfo.importedNames.push(name);
                                    if (element.propertyName) {
                                        importInfo.alias = name;
                                    }
                                });
                            }
                        }

                        imports.push(importInfo);
                    }
                }
            }

            ts.forEachChild(node, visit);
        }

        visit(sourceFile);
    } catch (error) {
        console.error('Failed to extract imports:', error);
    }

    return imports;
}

/**
 * 递归清理模块缓存及其依赖
 */
function generateCacheClearingCode(resolvedModuleName: string): string {
    return `
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
})('${resolvedModuleName}');`.trim();
}

/**
 * 将导入语句转换为REPL兼容的导入语句
 * 优先使用普通的require，只有在必要时才使用动态import
 */
export function convertToReplImports(imports: ImportInfo[], currentFilePath?: string): string {
    if (imports.length === 0) return '';

    const importStatements: string[] = [];

    for (const imp of imports) {
        const { moduleName, importType, importedNames, alias } = imp;

        // 检查是否是内置模块或第三方模块
        if (isBuiltinModule(moduleName) || (!moduleName.startsWith('.') && !moduleName.startsWith('/'))) {
            // 对于内置模块和第三方模块，直接使用require
            switch (importType) {
                case 'default':
                    importStatements.push(`const ${alias} = require('${moduleName}');`);
                    break;
                case 'named':
                    if (importedNames.length > 0) {
                        const destructuring = importedNames.join(', ');
                        importStatements.push(`const { ${destructuring} } = require('${moduleName}');`);
                    }
                    break;
                case 'namespace':
                    importStatements.push(`const ${alias} = require('${moduleName}');`);
                    break;
                case 'require':
                    // 保持原样
                    if (importedNames.length === 1 && !isDestructuring(imp.originalStatement)) {
                        importStatements.push(`const ${importedNames[0]} = require('${moduleName}');`);
                    } else {
                        const destructuring = importedNames.join(', ');
                        importStatements.push(`const { ${destructuring} } = require('${moduleName}');`);
                    }
                    break;
            }
        } else {
            // 对于本地文件，需要调整路径以适应REPL工作目录
            let resolvedModuleName = moduleName;

            // 如果提供了当前文件路径，则计算相对于项目根目录的路径
            if (currentFilePath && (moduleName.startsWith('./') || moduleName.startsWith('../'))) {
                resolvedModuleName = resolveModulePath(moduleName, currentFilePath);
            }

            // 对于本地文件，需要递归清理缓存以确保获取最新内容
            importStatements.push(generateCacheClearingCode(resolvedModuleName));

            // 然后进行正常的require
            switch (importType) {
                case 'default':
                    importStatements.push(`const ${alias} = require('${resolvedModuleName}');`);
                    break;
                case 'named':
                    if (importedNames.length > 0) {
                        const destructuring = importedNames.join(', ');
                        importStatements.push(`const { ${destructuring} } = require('${resolvedModuleName}');`);
                    }
                    break;
                case 'namespace':
                    importStatements.push(`const ${alias} = require('${resolvedModuleName}');`);
                    break;
                case 'require':
                    // 保持原样
                    if (importedNames.length === 1 && !isDestructuring(imp.originalStatement)) {
                        importStatements.push(`const ${importedNames[0]} = require('${resolvedModuleName}');`);
                    } else {
                        const destructuring = importedNames.join(', ');
                        importStatements.push(`const { ${destructuring} } = require('${resolvedModuleName}');`);
                    }
                    break;
                case 'dynamic':
                    // 动态导入转换为同步require（REPL中更简单）
                    if (importedNames.length === 1 && !imp.originalStatement.includes('{')) {
                        // const module = await import('./utils') -> const module = require('./src/utils')
                        importStatements.push(`const ${importedNames[0]} = require('${resolvedModuleName}');`);
                    } else {
                        // const { testUtils } = await import('./utils') -> const { testUtils } = require('./src/utils')
                        const destructuring = importedNames.join(', ');
                        importStatements.push(`const { ${destructuring} } = require('${resolvedModuleName}');`);
                    }
                    break;
            }
        }
    }

    return importStatements.join('\n') + (importStatements.length > 0 ? '\n' : '');
}

/**
 * 解析模块路径，将相对于当前文件的路径转换为相对于项目根目录的路径
 */
function resolveModulePath(moduleName: string, currentFilePath: string): string {
    // 如果不是相对路径，直接返回
    if (!moduleName.startsWith('./') && !moduleName.startsWith('../')) {
        return moduleName;
    }

    try {
        // 尝试使用VS Code API获取工作区根目录
        const vscode = require('vscode');
        const workspaceFolders = vscode.workspace?.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const relativePath = currentFilePath.replace(workspaceRoot, '');
            const currentDir = require('path').dirname(relativePath);

            // 使用path.resolve来解析相对路径
            const resolvedPath = require('path').resolve(currentDir, moduleName);
            // 确保路径以./开始（相对路径）
            return resolvedPath.startsWith('/') ? '.' + resolvedPath : resolvedPath;
        }
    } catch (error) {
        // VS Code API不可用时的后备方案
    }

    // 简单的后备方案：如果当前文件在src目录中，调整路径
    if (currentFilePath.includes('/src/')) {
        // 对于 src/xxx.ts 中的 ./main，应该变成 ./src/main
        if (moduleName.startsWith('./')) {
            return './src/' + moduleName.substring(2);
        }
    }

    return moduleName;
}

/**
 * 检查是否是解构赋值的 require 语句
 */
function isDestructuring(statement: string): boolean {
    return statement.includes('{') && statement.includes('}');
}

/**
 * 检查模块是否是内置模块
 */
export function isBuiltinModule(moduleName: string): boolean {
    const builtinModules = [
        'fs', 'path', 'http', 'https', 'crypto', 'util', 'os', 'url', 'events',
        'stream', 'buffer', 'querystring', 'readline', 'child_process', 'cluster',
        'dgram', 'dns', 'net', 'tls', 'zlib', 'assert', 'module', 'process',
        'vm', 'worker_threads', 'async_hooks', 'perf_hooks', 'trace_events'
    ];

    return builtinModules.includes(moduleName) || moduleName.startsWith('node:');
}

/**
 * 检查代码是否需要async包装（仅当使用了await但不是顶层时）
 */
export function needsAsyncWrapper(code: string): boolean {
    return code.includes('await import(') && !code.trim().startsWith('const') && !code.trim().startsWith('let') && !code.trim().startsWith('var');
}