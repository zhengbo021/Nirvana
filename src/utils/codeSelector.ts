import * as vscode from 'vscode';
import { getExecutableCodeAtCursor } from './tsSourceCodeUtils';

export async function getExecutableCode(editor: vscode.TextEditor): Promise<string | null> {
    const document = editor.document;
    const selection = editor.selection;

    if (!selection.isEmpty) {
        return document.getText(selection);
    }

    const cursorPosition = selection.active;
    const sourceCode = document.getText();
    const offset = document.offsetAt(cursorPosition);

    const astBasedCode = getExecutableCodeAtCursor(document, sourceCode, offset);
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