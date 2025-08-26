import * as vscode from 'vscode';

const activeDecorations = new Map<vscode.TextEditor, vscode.TextEditorDecorationType[]>();

/**
 * 找到合适的行来显示内联结果
 */
function findBestDisplayLine(editor: vscode.TextEditor, cursorPosition: vscode.Position, range: vscode.Range): number {
    const document = editor.document;

    // 首先检查光标所在行是否有代码内容
    const cursorLine = cursorPosition.line;
    const lineText = document.lineAt(cursorLine).text.trim();

    // 如果光标行有代码内容且不只是注释，就在这行显示
    if (lineText.length > 0 && !lineText.startsWith('//') && !lineText.startsWith('/*')) {
        return cursorLine;
    }

    // 否则，向下查找代码执行范围内的下一行有意义的代码
    const startLine = Math.max(cursorLine, range.start.line);
    const endLine = range.end.line;

    for (let line = startLine; line <= endLine; line++) {
        const text = document.lineAt(line).text.trim();
        if (text.length > 0 && !text.startsWith('//') && !text.startsWith('/*')) {
            return line;
        }
    }

    // 如果都没找到，就使用光标位置
    return cursorLine;
}

export function showInlineResult(editor: vscode.TextEditor, range: vscode.Range, result: string, cursorPosition?: vscode.Position): void {
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

    // 使用智能逻辑确定最佳显示位置
    const displayLine = cursorPosition
        ? findBestDisplayLine(editor, cursorPosition, range)
        : range.end.line;

    const lastLineRange = new vscode.Range(
        new vscode.Position(displayLine, 0),
        new vscode.Position(displayLine, editor.document.lineAt(displayLine).text.length)
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

export function getCodeExecutionRange(editor: vscode.TextEditor, code: string, cursorPosition?: vscode.Position): vscode.Range | null {
    const document = editor.document;
    const text = document.getText();
    const codeToFind = code.trim();

    // 如果没有提供光标位置，使用当前光标位置
    const targetPosition = cursorPosition || editor.selection.active;
    const cursorOffset = document.offsetAt(targetPosition);

    let bestMatch: { startIndex: number; distance: number } | null = null;
    
    // 找到所有匹配的位置，选择最接近光标的一个
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

    if (bestMatch) {
        const startPos = document.positionAt(bestMatch.startIndex);
        const endPos = document.positionAt(bestMatch.startIndex + codeToFind.length);
        return new vscode.Range(startPos, endPos);
    }

    // 如果没有找到匹配，回退到原有逻辑
    if (!editor.selection.isEmpty) {
        return editor.selection;
    } else {
        const cursorLine = targetPosition.line;
        const line = document.lineAt(cursorLine);
        return line.range;
    }
}

export function showInlineError(editor: vscode.TextEditor, range: vscode.Range, error: string, cursorPosition?: vscode.Position): void {
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

    // 使用智能逻辑确定最佳显示位置
    const displayLine = cursorPosition
        ? findBestDisplayLine(editor, cursorPosition, range)
        : range.end.line;

    const lastLineRange = new vscode.Range(
        new vscode.Position(displayLine, 0),
        new vscode.Position(displayLine, editor.document.lineAt(displayLine).text.length)
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
