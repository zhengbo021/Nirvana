import * as vscode from 'vscode';
import { registerCommands } from './command';
import { onEditorClosed, clearInlineResults } from './utils/inlineResults';

export async function activate(context: vscode.ExtensionContext) {
	registerCommands(context);

	// 监听编辑器切换事件
	const editorCloseDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			onEditorClosed(editor);
		}
	});
	context.subscriptions.push(editorCloseDisposable);

	// 监听光标移动事件 - 清理内联结果
	const cursorMoveDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
		clearInlineResults(event.textEditor);
	});
	context.subscriptions.push(cursorMoveDisposable);
}

export function deactivate() {
}