import * as vscode from 'vscode';
import * as ts from 'typescript';

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

const getASTBasedCode = (
    document: vscode.TextDocument,
    sourceCode: string,
    offset: number
): string | null => {
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
};

export async function getExecutableCode(editor: vscode.TextEditor): Promise<string | null> {
    const document = editor.document;
    const selection = editor.selection;

    if (!selection.isEmpty) {
        return document.getText(selection);
    }

    const cursorPosition = selection.active;
    const sourceCode = document.getText();
    const offset = document.offsetAt(cursorPosition);

    const astBasedCode = getASTBasedCode(document, sourceCode, offset);
    if (astBasedCode !== null) {
        return astBasedCode;
    }

    const currentLine = document.lineAt(cursorPosition.line);
    return currentLine.text.trim();
}

export async function highlightExecutableCode(editor: vscode.TextEditor, code: string) {
    const document = editor.document;
    const text = document.getText();
    const startIndex = text.indexOf(code);

    if (startIndex !== -1) {
        const startPos = document.positionAt(startIndex);
        const endPos = document.positionAt(startIndex + code.length);
        const range = new vscode.Range(startPos, endPos);

        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('editor.selectionForeground')
        });

        editor.setDecorations(decorationType, [range]);
        setTimeout(() => decorationType.dispose(), 2000);
    }
}