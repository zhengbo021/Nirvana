import vscode from "vscode";
let output: vscode.OutputChannel;

async function setUp() {
  if (output != null) {
    return;
  }

  output = vscode.window.createOutputChannel("Nirvana");
}

export async function appendNewLine(msg: string) {
  await setUp();
  output.appendLine(msg);
}

export async function show() {
  await setUp();
  output.show(true);
}

export async function hide() {
  if (output == null) {
    return;
  }
  output.hide();
}

export async function clear() {
  if (output == null) {
    return;
  }
  output.clear();
}
