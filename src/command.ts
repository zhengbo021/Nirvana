import vscode from "vscode";
import { appendNewLine, show } from "./util/nirvanaOutput";
import {
  getEnvFileNames,
  getValidTsFileNames,
} from "./util/workingDirectoryUtils";
import { DI } from "./repl/repl";
import * as repl from "./repl/repl";

const commands: Record<string, () => Promise<void>> = {
  "Nirvana.startRepl": startRepl,
};

async function getWorkingDirectory(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }
  return workspaceFolders[0].uri.fsPath;
}

const diOptions: { label: DI; description: string }[] = [
  {
    label: "None",
    description: "None is for projects that do not use any DI framework.",
  },
  {
    label: "NestJs",
    description:
      "NestJS is a popular framework for building scalable server-side applications.",
  },
  {
    label: "Other",
    description: "Other is a generic option for any other DI framework.",
  },
];
async function askUserWhichDiFrameworkIsInUse(): Promise<DI | undefined> {
  const selected = await vscode.window.showQuickPick(diOptions, {
    placeHolder: "Select a DI framework you are using",
  });
  if (selected == null) {
    return undefined;
  }

  return selected.label === "None"
    ? "None"
    : selected.label === "Other"
      ? "Other"
      : "NestJs";
}

async function askUserNestJsMainModulePath(
  workingDirectory: string,
): Promise<string | undefined> {
  const fileNames = await getValidTsFileNames(workingDirectory);
  const selected = await vscode.window.showQuickPick(fileNames, {
    placeHolder: "Select your NestJS main module",
  });
  if (!selected) {
    return undefined;
  }
  appendNewLine(`nestJs main module: ${workingDirectory}/${selected}`);
  return workingDirectory + "/" + selected;
}

async function askUserWhichEnvFileToUse(
  workingDirectory: string,
): Promise<string | undefined | "None"> {
  const fileNames = await getEnvFileNames(workingDirectory);
  const selected = await vscode.window.showQuickPick(["None", ...fileNames], {
    placeHolder: "Select your .env file",
  });
  if (!selected) {
    return undefined;
  }
  appendNewLine(`.env file: ${workingDirectory}/${selected}`);
  return workingDirectory + "/" + selected;
}

export async function startRepl() {
  show();
  const workingDirectory = await getWorkingDirectory();
  if (!workingDirectory) {
    await vscode.window.showErrorMessage("No workspace is open.");
    appendNewLine("No workspace is open.");
    return;
  }
  const di = await askUserWhichDiFrameworkIsInUse();
  if (di === undefined || di === null) {
    await vscode.window.showErrorMessage("Should choose a DI framework.");
    appendNewLine("Should choose a DI framework.");
    return;
  }
  let nestJsMainModulePath: string | undefined = undefined;
  if (di === "NestJs") {
    const path = await askUserNestJsMainModulePath(workingDirectory);
    if (path === undefined || path === null) {
      await vscode.window.showErrorMessage(
        "Should specify your nestjs main module path",
      );
      appendNewLine("Should specify your nestjs main module path");
      return;
    }
    nestJsMainModulePath = path;
  }

  const envFile = await askUserWhichEnvFileToUse(workingDirectory);
  if (envFile === undefined || envFile === null) {
    await vscode.window.showErrorMessage("Should specify your .env file");
    appendNewLine("Should specify your .env file");
    return;
  }
  const result = await repl.startRepl({
    workingDirectory: workingDirectory,
    diInUse: {
      di: di,
      nestJsMainModule: nestJsMainModulePath,
    },
    envFilePath: envFile === "None" ? undefined : envFile,
  });
  if (result.suc) {
    appendNewLine("Repl started successfully");
    vscode.window.showInformationMessage("Repl started successfully");
  } else {
    show();
    appendNewLine(`Failed to start repl due to: ${result.message}`);
    vscode.window.showErrorMessage("Failed to start repl");
  }
}

export function registerCommands(context: vscode.ExtensionContext) {
  for (const commandName of Object.keys(commands)) {
    const runner = commands[commandName];
    const disposable = vscode.commands.registerCommand(commandName, runner);
    context.subscriptions.push(disposable);
  }
}
