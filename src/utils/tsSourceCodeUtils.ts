import * as ts from 'typescript'
import * as nirvanaOutput from '../nirvanaOutput'
import * as vscode from 'vscode';

export async function convertLetAndConstToVar(code: string): Promise<string | null> {
    try {
        const sourceFile = ts.createSourceFile(
            'temp.ts',
            code,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS
        );

        const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
            return (sourceFile) => {
                const visitor = (node: ts.Node): ts.Node => {
                    // Handle variable declarations (let/const -> var)
                    if (ts.isVariableDeclarationList(node)) {
                        // Check if it's let or const
                        if (node.flags & ts.NodeFlags.Let || node.flags & ts.NodeFlags.Const) {
                            // Create a new variable declaration list with var flag
                            return context.factory.createVariableDeclarationList(
                                node.declarations,
                                ts.NodeFlags.None // This removes let/const flags, making it var
                            );
                        }
                    }
                    return ts.visitEachChild(node, visitor, context);
                };
                return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
            };
        };

        const result = ts.transform(sourceFile, [transformer]);
        const printer = ts.createPrinter();
        const transformedCode = printer.printFile(result.transformed[0]);

        result.dispose();

        // Clean up the output - remove extra whitespace and semicolons
        return transformedCode.replace(/;\s*$/, '').trim();
    } catch (error) {
        nirvanaOutput.appendLine(`⚠️ TypeScript parsing failed: ${error}`);
        return null;
    }
}

const getScriptKind = (languageId: string): ts.ScriptKind => {
    switch (languageId) {
        case 'typescript': return ts.ScriptKind.TS;
        case 'typescriptreact': return ts.ScriptKind.TSX;
        case 'javascript': return ts.ScriptKind.JS;
        case 'javascriptreact': return ts.ScriptKind.JSX;
        default: return ts.ScriptKind.TS;
    }
};

const isInsideFunction = (node: ts.Node): boolean => {
    let parent = node.parent;
    while (parent) {
        if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent) || ts.isFunctionDeclaration(parent)) {
            return true;
        }
        parent = parent.parent;
    }
    return false;
};

const findDeepestNode = (sourceFile: ts.SourceFile, offset: number): ts.Node | null => {
    let deepestNode: ts.Node | null = null;
    ts.forEachChild(sourceFile, function visit(node) {
        if (offset >= node.getStart() && offset <= node.getEnd()) {
            deepestNode = node;
            ts.forEachChild(node, visit);
        }
    });
    return deepestNode;
};

const findImmediateStatement = (sourceFile: ts.SourceFile, offset: number): ts.Node | null => {
    let currentNode = findDeepestNode(sourceFile, offset);
    while (currentNode && currentNode !== sourceFile) {
        if (ts.isStatement(currentNode) || ts.isCallExpression(currentNode)) {
            return currentNode;
        }
        currentNode = currentNode.parent;
    }
    return null;
};

const findLogicalBlock = (
    sourceFile: ts.SourceFile,
    parent: ts.SourceFile | ts.Block,
    startNode: ts.Node,
    sourceCode: string
): string | null => {
    const statements = parent.statements;
    if (!statements) return null;

    const startIndex = statements.indexOf(startNode as ts.Statement);
    if (startIndex === -1) return null;

    let blockStart = startIndex;
    let blockEnd = startIndex;

    for (let i = startIndex - 1; i >= 0; i--) {
        const prevNode = statements[i];
        const prevLine = sourceFile.getLineAndCharacterOfPosition(prevNode.getEnd()).line;
        const currentLine = sourceFile.getLineAndCharacterOfPosition(statements[i + 1].getStart()).line;
        if (ts.isStatement(prevNode) && (currentLine - prevLine <= 1)) {
            blockStart = i;
        } else {
            break;
        }
    }

    for (let i = startIndex + 1; i < statements.length; i++) {
        const nextNode = statements[i];
        const prevLine = sourceFile.getLineAndCharacterOfPosition(statements[i - 1].getEnd()).line;
        const currentLine = sourceFile.getLineAndCharacterOfPosition(nextNode.getStart()).line;
        if (ts.isStatement(nextNode) && (currentLine - prevLine <= 1)) {
            blockEnd = i;
        } else {
            break;
        }
    }

    const startOffset = statements[blockStart].getStart();
    const endOffset = statements[blockEnd].getEnd();
    return sourceCode.substring(startOffset, endOffset).trim();
};

export function getExecutableCodeAtCursor(document: vscode.TextDocument,
    sourceCode: string,
    offset: number) {
    try {
        const sourceFile = ts.createSourceFile(
            document.fileName,
            sourceCode,
            ts.ScriptTarget.Latest,
            true,
            getScriptKind(document.languageId)
        );
        const immediateStatement = findImmediateStatement(sourceFile, offset);
        if (!immediateStatement) return null;

        const parent = immediateStatement.parent;
        const isTopLevelOrBlock = ts.isSourceFile(parent) || ts.isBlock(parent);

        if (isInsideFunction(immediateStatement)) {
            return sourceCode.substring(immediateStatement.getStart(), immediateStatement.getEnd()).trim();
        }

        if (isTopLevelOrBlock) {
            return findLogicalBlock(sourceFile, parent as ts.SourceFile | ts.Block, immediateStatement, sourceCode);
        }

        return sourceCode.substring(immediateStatement.getStart(), immediateStatement.getEnd()).trim();
    } catch (error) {
        console.error('AST analysis failed:', error);
        return null;
    }
}