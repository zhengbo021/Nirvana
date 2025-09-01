import vscode from "vscode";
import Sinon from "sinon";
import * as command from "../command";
import * as repl from "../repl/repl";
import assert from "assert";
import { ReplContext, ReplStartsDetails } from "../repl/repl";

const nestJsProjectFolder =
  "/Users/zhengma/Desktop/code/nirvana/nirvana/test-projects/nestjs";
suite("Command tests", () => {
  let vsCodeRegisterCommandStub: Sinon.SinonStub;
  let context: vscode.ExtensionContext;
  let subscriptionsPushSpy: Sinon.SinonSpy;

  setup(() => {
    vsCodeRegisterCommandStub = Sinon.stub(vscode.commands, "registerCommand");
    const mockedSubscription: any[] = [];
    subscriptionsPushSpy = Sinon.spy(mockedSubscription, "push");
    context = {
      subscriptions: mockedSubscription,
    } as unknown as vscode.ExtensionContext;
  });

  teardown(() => {
    vsCodeRegisterCommandStub.restore();
    subscriptionsPushSpy.restore();
  });

  suiteTeardown(() => {
    Sinon.restore();
  });

  test("Should register all commands", async () => {
    const commandsShouldRegister = ["Nirvana.startRepl"];
    command.registerCommands(context);
    assert.equal(
      vsCodeRegisterCommandStub.callCount,
      commandsShouldRegister.length,
    );
    assert.equal(subscriptionsPushSpy.callCount, commandsShouldRegister.length);
    commandsShouldRegister.forEach((command, index) => {
      const call = vsCodeRegisterCommandStub.getCall(index);
      assert.ok(
        call.calledWith(command, Sinon.match.func),
        `Expected command ${command} to be registered`,
      );
    });
  });
});

suite("Start repl tests", () => {
  let showErrorStub: Sinon.SinonStub;
  let showInfoStub: Sinon.SinonStub;
  let workingDirectoryStub: Sinon.SinonStub;
  let showQuickPickStub: Sinon.SinonStub;
  let startReplStub: Sinon.SinonStub;

  setup(() => {
    showErrorStub = Sinon.stub(vscode.window, "showErrorMessage");
    showInfoStub = Sinon.stub(vscode.window, "showInformationMessage");
    workingDirectoryStub = Sinon.stub(vscode.workspace, "workspaceFolders");
    showQuickPickStub = Sinon.stub(vscode.window, "showQuickPick");
    startReplStub = Sinon.stub(repl, "startRepl");
  });

  teardown(() => {
    showErrorStub.restore();
    showInfoStub.restore();
    workingDirectoryStub.restore();
    showQuickPickStub.restore();
    startReplStub.restore();
  });

  suiteTeardown(() => {
    Sinon.restore();
  });

  test("Should show error if working directory is not set", async () => {
    workingDirectoryStub.value([]);
    await command.startRepl();
    assert.ok(showErrorStub.calledOnce);
    assert.ok(showErrorStub.calledWith("No workspace is open."));
  });

  test("Should ask user which DI framework in use", async () => {
    workingDirectoryStub.value([
      {
        uri: vscode.Uri.file(nestJsProjectFolder),
      },
    ]);
    await command.startRepl();
    assert(showQuickPickStub.calledOnce);
    const call = showQuickPickStub.getCall(0);
    const pickOptions: { label: string }[] = call.args[0];
    const options: { placeHolder: string } = call.args[1];
    assert.strictEqual(
      pickOptions.map((it) => it.label).join(","),
      "None,NestJs,Other",
    );
    assert.strictEqual(
      options.placeHolder,
      "Select a DI framework you are using",
    );
  });

  test("Should abort if user dont choose which DI framework is in use", async () => {
    workingDirectoryStub.value([
      {
        uri: vscode.Uri.file(nestJsProjectFolder),
      },
    ]);
    showQuickPickStub.resolves(undefined);
    await command.startRepl();
    assert(showQuickPickStub.calledOnce);
    assert.strictEqual(
      showErrorStub.getCall(0).calledWith("Should choose a DI framework."),
      true,
    );
  });

  test("Should ask user the nestJs app module path", async () => {
    workingDirectoryStub.value([
      {
        uri: vscode.Uri.file(nestJsProjectFolder),
      },
    ]);
    showQuickPickStub.onCall(0).resolves({
      label: "NestJs",
    });
    await command.startRepl();
    const appModulePathQuickPickCall = showQuickPickStub.getCall(1);
    const appModulePathPickOptions: string[] =
      appModulePathQuickPickCall.args[0];
    assert.ok(
      appModulePathPickOptions.some((it) => it.includes("src/app.module.ts")),
    );
    assert.strictEqual(showQuickPickStub.callCount, 2);
  });

  test("Should abort if user doesn't select the app module", async () => {
    workingDirectoryStub.value([
      {
        uri: vscode.Uri.file(nestJsProjectFolder),
      },
    ]);
    showQuickPickStub.onCall(0).resolves({
      label: "NestJs",
    });
    showQuickPickStub.onCall(1).resolves(null);
    await command.startRepl();
    assert.strictEqual(showQuickPickStub.callCount, 2);
    assert.strictEqual(showErrorStub.callCount, 1);
    assert.strictEqual(
      showErrorStub.getCall(0).args[0],
      "Should specify your nestjs main module path",
    );
  });

  test("Should ask user which env file to use", async () => {
    workingDirectoryStub.value([
      {
        uri: vscode.Uri.file(nestJsProjectFolder),
      },
    ]);
    showQuickPickStub.onCall(0).resolves({
      label: "NestJs",
    });
    showQuickPickStub.onCall(1).resolves("src/app.module.ts");
    await command.startRepl();
    assert.strictEqual(showQuickPickStub.callCount, 3);
    const envFileQuickPickCall = showQuickPickStub.getCall(2);
    const envFilePickOptions: string[] = envFileQuickPickCall.args[0];
    assert.ok(envFilePickOptions.some((it) => it.includes(".dev.env")));
  });

  test("Should abort if user doesn`t select env file", async () => {
    workingDirectoryStub.value([
      {
        uri: vscode.Uri.file(nestJsProjectFolder),
      },
    ]);
    showQuickPickStub.onCall(0).resolves({
      label: "NestJs",
    });
    showQuickPickStub.onCall(1).resolves("src/app.module.ts");
    showQuickPickStub.onCall(2).resolves(null);
    await command.startRepl();
    assert.strictEqual(showQuickPickStub.callCount, 3);
    assert.strictEqual(showErrorStub.callCount, 1);
    assert.strictEqual(
      showErrorStub.getCall(0).args[0],
      "Should specify your .env file",
    );
  });

  test("Should show error if repl start fails", async () => {
    workingDirectoryStub.value([
      {
        uri: vscode.Uri.file(nestJsProjectFolder),
      },
    ]);
    showQuickPickStub.onCall(0).resolves({
      label: "NestJs",
    });
    showQuickPickStub.onCall(1).resolves("src/app.module.ts");
    showQuickPickStub.onCall(2).resolves("src/.env");
    startReplStub.resolves({
      suc: false,
      message: "Failed to start repl",
    } as ReplStartsDetails);
    await command.startRepl();
    assert.strictEqual(showQuickPickStub.callCount, 3);
    assert.strictEqual(showErrorStub.callCount, 1);
    assert.strictEqual(
      showErrorStub.getCall(0).args[0],
      "Failed to start repl",
    );
  });

  test("Should start repl successfully", async () => {
    workingDirectoryStub.value([
      {
        uri: vscode.Uri.file(nestJsProjectFolder),
      },
    ]);
    showQuickPickStub.onCall(0).resolves({
      label: "NestJs",
    });
    showQuickPickStub.onCall(1).resolves("src/app.module.ts");
    showQuickPickStub.onCall(2).resolves("src/.env");
    startReplStub.resolves({
      suc: true,
      message: "Repl started successfully",
    } as ReplStartsDetails);
    await command.startRepl();
    assert.strictEqual(showQuickPickStub.callCount, 3);
    assert.strictEqual(showErrorStub.callCount, 0);
    assert.strictEqual(startReplStub.callCount, 1);
    const replContext = {
      workingDirectory: nestJsProjectFolder,
      diInUse: {
        di: "NestJs",
        nestJsMainModule: `${nestJsProjectFolder}/src/app.module.ts`,
      },
      envFilePath: `${nestJsProjectFolder}/src/.env`,
    } as ReplContext;
    assert.ok(startReplStub.calledWith(replContext));
    assert.ok(showInfoStub.calledWith("Repl started successfully"));
    assert.ok(showInfoStub.calledOnce);
    assert.ok(showInfoStub.calledAfter(startReplStub));
  });
});
