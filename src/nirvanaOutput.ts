import * as vscode from 'vscode'

let outputChannel: vscode.OutputChannel;
export function setUp() {
    outputChannel = vscode.window.createOutputChannel('Nirvana');
}
export function appendLine(line: string) {
    if (!outputChannel) {
        setUp();
    }
    outputChannel.appendLine(line);
}

export function show() {
    if (!outputChannel) {
        setUp();
    }
    outputChannel.show(true);
}