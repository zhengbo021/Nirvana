import * as vscode from 'vscode';

const activeDecorations = new Map<vscode.TextEditor, vscode.TextEditorDecorationType[]>();

export function showInlineResult(editor: vscode.TextEditor, range: vscode.Range, result: string): void {
    clearInlineResults(editor);

    const formattedResult = formatResult(result);

    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: ` => ${formattedResult}`,
            color: new vscode.ThemeColor('editorCodeLens.foreground'),
            fontStyle: 'italic',
            margin: '0 0 0 1em',
            textDecoration: 'none'
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });

    const lastLine = range.end.line;
    const lastLineRange = new vscode.Range(
        new vscode.Position(lastLine, 0),
        new vscode.Position(lastLine, editor.document.lineAt(lastLine).text.length)
    );

    editor.setDecorations(decorationType, [lastLineRange]);

    if (!activeDecorations.has(editor)) {
        activeDecorations.set(editor, []);
    }
    activeDecorations.get(editor)!.push(decorationType);

    setTimeout(() => {
        clearInlineResults(editor);
    }, 30000);
}

function formatResult(result: string): string {
    if (!result) return '';

    let formatted = result.trim();

    const maxLength = 100;
    if (formatted.length > maxLength) {
        formatted = formatted.substring(0, maxLength) + '...';
    }

    formatted = formatted.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    return formatted;
}

export function clearInlineResults(editor: vscode.TextEditor): void {
    const decorations = activeDecorations.get(editor);
    if (decorations) {
        decorations.forEach(decoration => decoration.dispose());
        activeDecorations.delete(editor);
    }
}

export function clearAllInlineResults(): void {
    for (const [editor, decorations] of activeDecorations) {
        decorations.forEach(decoration => decoration.dispose());
    }
    activeDecorations.clear();
}

export function onEditorClosed(editor: vscode.TextEditor): void {
    clearInlineResults(editor);
}

export function getCodeExecutionRange(editor: vscode.TextEditor, code: string): vscode.Range | null {
    const document = editor.document;
    const text = document.getText();

    const startIndex = text.indexOf(code.trim());
    if (startIndex === -1) {
        if (!editor.selection.isEmpty) {
            return editor.selection;
        } else {
            const cursorLine = editor.selection.active.line;
            const line = document.lineAt(cursorLine);
            return line.range;
        }
    }

    const startPos = document.positionAt(startIndex);
    const endPos = document.positionAt(startIndex + code.trim().length);

    return new vscode.Range(startPos, endPos);
}

export function showInlineError(editor: vscode.TextEditor, range: vscode.Range, error: string): void {
    clearInlineResults(editor);

    const formattedError = formatResult(error);

    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: ` => Error: ${formattedError}`,
            color: new vscode.ThemeColor('errorForeground'),
            fontStyle: 'italic',
            margin: '0 0 0 1em',
            textDecoration: 'none'
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });

    const lastLine = range.end.line;
    const lastLineRange = new vscode.Range(
        new vscode.Position(lastLine, 0),
        new vscode.Position(lastLine, editor.document.lineAt(lastLine).text.length)
    );

    editor.setDecorations(decorationType, [lastLineRange]);

    if (!activeDecorations.has(editor)) {
        activeDecorations.set(editor, []);
    }
    activeDecorations.get(editor)!.push(decorationType);

    setTimeout(() => {
        clearInlineResults(editor);
    }, 60000);
}
