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

export async function highlightExecutableCode(editor: vscode.TextEditor, code: string, cursorPosition?: vscode.Position, executionRange?: vscode.Range) {
    // 如果提供了执行范围，直接使用它进行高亮
    if (executionRange) {
        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('editor.selectionForeground')
        });

        editor.setDecorations(decorationType, [executionRange]);
        setTimeout(() => decorationType.dispose(), 2000);
        return;
    }

    // 原有的基于光标位置的逻辑作为后备方案
    const document = editor.document;
    const text = document.getText();
    
    let bestMatch: { startIndex: number; distance: number } | null = null;
    
    if (cursorPosition) {
        const cursorOffset = document.offsetAt(cursorPosition);
        const codeToFind = code.trim();
        
        // 找到所有匹配的位置
        let searchIndex = 0;
        while (searchIndex < text.length) {
            const matchIndex = text.indexOf(codeToFind, searchIndex);
            if (matchIndex === -1) break;
            
            const distance = Math.abs(matchIndex - cursorOffset);
            if (!bestMatch || distance < bestMatch.distance) {
                bestMatch = { startIndex: matchIndex, distance };
            }
            
            searchIndex = matchIndex + 1;
        }
        
        // 使用最接近光标的匹配
        if (bestMatch) {
            const startPos = document.positionAt(bestMatch.startIndex);
            const endPos = document.positionAt(bestMatch.startIndex + codeToFind.length);
            const range = new vscode.Range(startPos, endPos);

            const decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
                border: '1px solid',
                borderColor: new vscode.ThemeColor('editor.selectionForeground')
            });

            editor.setDecorations(decorationType, [range]);
            setTimeout(() => decorationType.dispose(), 2000);
            return;
        }
    }
    
    // 最后的后备方案：使用第一个匹配
    const startIndex = text.indexOf(code.trim());
    if (startIndex !== -1) {
        const startPos = document.positionAt(startIndex);
        const endPos = document.positionAt(startIndex + code.trim().length);
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