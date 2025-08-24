import assert from 'assert';
import * as cmd from '../command';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as repl from '../repl/repl';
import * as nestJsTypeGenerator from '../repl/typeDefinitionGenerator'
suite('command tests', () => {
    test('commands should be registered', () => {
        assert.strictEqual(cmd.commands.length, 5);
        assert.strictEqual(cmd.commands[0][0], "Nirvana.startRepl");
        assert.strictEqual(typeof cmd.commands[0][1], 'function');
        assert.strictEqual(cmd.commands[3][0], "Nirvana.executeCode");
        assert.strictEqual(typeof cmd.commands[3][1], 'function');
        assert.strictEqual(cmd.commands[4][0], "Nirvana.configuration");
        assert.strictEqual(typeof cmd.commands[4][1], 'function');
    });
});

suite('start repl tests', () => {
    let showErrorMessageStub: sinon.SinonStub;
    let showWarningMessageStub: sinon.SinonStub;
    let workspaceFoldersStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let startReplStub: sinon.SinonStub;
    let showQuickPickStub: sinon.SinonStub;
    let showOpenDialogStub: sinon.SinonStub;
    let findFilesStub: sinon.SinonStub;
    let generateTypeDefinitionsStub: sinon.SinonStub;
    const startReplCmd = cmd.commands[0][1];

    // Mock workspace folder for testing
    const mockWorkspaceFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/test/workspace'),
        name: 'test-workspace',
        index: 0
    };

    setup(() => {
        // Create stubs for VS Code APIs
        showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
        workspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders');
        showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
        showOpenDialogStub = sinon.stub(vscode.window, 'showOpenDialog');
        findFilesStub = sinon.stub(vscode.workspace, 'findFiles');

        // Stub the repl.startRepl function to avoid actually starting a REPL during tests
        startReplStub = sinon.stub(repl, 'startRepl');
        // Default behavior: return success
        startReplStub.resolves([true, undefined]);

        // Mock the type generator
        generateTypeDefinitionsStub = sinon.stub(nestJsTypeGenerator, 'generateTypeDefinitions');
        generateTypeDefinitionsStub.resolves();
    });

    teardown(() => {
        // Restore all stubs after each test
        if (showErrorMessageStub) showErrorMessageStub.restore();
        if (showWarningMessageStub) showWarningMessageStub.restore();
        if (workspaceFoldersStub) workspaceFoldersStub.restore();
        if (showInformationMessageStub) showInformationMessageStub.restore();
        if (showQuickPickStub) showQuickPickStub.restore();
        if (showOpenDialogStub) showOpenDialogStub.restore();
        if (findFilesStub) findFilesStub.restore();
        if (startReplStub) startReplStub.restore();
        if (generateTypeDefinitionsStub) generateTypeDefinitionsStub.restore();
        sinon.restore();
    });

    suiteTeardown(() => {
        // Final cleanup
        sinon.restore();
    });

    test('should abort on user cancellation of project type selection', async () => {
        // Mock workspace folders
        workspaceFoldersStub.value([mockWorkspaceFolder]);
        // Mock user cancelling project type selection
        showQuickPickStub.resolves(undefined); // User cancelled

        await startReplCmd();

        // Verify that only the first QuickPick was called
        assert.strictEqual(showQuickPickStub.callCount, 1);
        assert.strictEqual(showWarningMessageStub.calledWith("No project type selected."), true);
    });

    test("should abort on user cancellation of main file selection", async () => {
        // Mock workspace folders
        workspaceFoldersStub.value([mockWorkspaceFolder]);
        showQuickPickStub.onCall(0).resolves('nestJs'); // Project type
        findFilesStub.resolves([vscode.Uri.file('/test/workspace/src/main.ts')]);
        // Mock user cancelling main file selection
        showQuickPickStub.onCall(1).resolves(undefined); // User cancelled

        await startReplCmd();

        assert.strictEqual(showQuickPickStub.callCount, 2);
        assert.strictEqual(findFilesStub.callCount, 1)
        assert.strictEqual(showWarningMessageStub.calledWith("No main file selected."), true);
    });

    test("should abort on user cancellation of env file selection", async () => {
        // Mock workspace folders
        workspaceFoldersStub.value([mockWorkspaceFolder]);
        showQuickPickStub.onCall(0).resolves('nestJs'); // Project type
        findFilesStub.resolves([vscode.Uri.file('/test/workspace/src/main.ts')]);
        showQuickPickStub.onCall(1).resolves({
            label: 'src/main.ts',
            uri: vscode.Uri.file('/test/workspace/src/main.ts')
        });
        showQuickPickStub.onCall(2).resolves(undefined); // User cancelled
        await startReplCmd();
        assert.strictEqual(showQuickPickStub.callCount, 3);
        assert.strictEqual(findFilesStub.callCount, 2);
        assert.strictEqual(showWarningMessageStub.calledWith("No .env file selected"), true);
    });

    test('should fail when no workspace folder setup', async () => {
        // Mock no workspace folders - but this check happens later in the flow
        workspaceFoldersStub.value(undefined);

        // Mock user selections that would normally happen
        showQuickPickStub.onCall(0).resolves('nestJs'); // Project type

        // Mock findFiles to return some files
        const mockFile = vscode.Uri.file('/test/workspace/src/main.ts');
        findFilesStub.onCall(0).resolves([mockFile]); // For main file search
        findFilesStub.onCall(1).resolves([vscode.Uri.file('None')]); // For env file search

        // Mock asRelativePath

        // Mock user selecting main file
        showQuickPickStub.onCall(1).resolves({
            label: 'src/main.ts',
            uri: mockFile
        });

        // Mock user selecting env file
        showQuickPickStub.onCall(2).resolves({
            label: '.env',
            uri: vscode.Uri.file('/test/workspace/.env')
        });

        await startReplCmd();

        // The error should happen after all user interactions
        assert.strictEqual(showQuickPickStub.callCount, 3); // All user interactions completed
        assert.strictEqual(showErrorMessageStub.calledOnce, true);
        assert.strictEqual(showErrorMessageStub.calledWith('No workspace folder open.'), true);
    });

    test('should fail when workspace folders array is empty', async () => {
        workspaceFoldersStub.value([]);
        const mockFile = { label: 'src/main.ts', uri: vscode.Uri.file('/test/workspace/src/main.ts') };
        findFilesStub.onCall(0).resolves([mockFile]); // For main file search
        findFilesStub.onCall(1).resolves([mockFile]); // For env file search
        showQuickPickStub.onCall(0).resolves("nestJs");
        showQuickPickStub.onCall(1).resolves(mockFile);
        showQuickPickStub.onCall(2).resolves({
            label: "None",
            uri: vscode.Uri.file('None')
        });

        await startReplCmd();

        // Verify that showErrorMessage was called with the expected message
        assert.strictEqual(showQuickPickStub.calledThrice, true);
        assert.strictEqual(showErrorMessageStub.calledWith('No workspace folder open.'), true);
    });

    test('should handle user cancellation at project type selection', async () => {
        // Mock workspace folders
        workspaceFoldersStub.value([mockWorkspaceFolder]);

        // Mock user cancelling project type selection
        showQuickPickStub.resolves(undefined); // User cancelled

        // Mock findFiles (won't be called due to early return)
        findFilesStub.resolves([]);

        await startReplCmd();

        // Verify that only the first QuickPick was called
        assert.strictEqual(showQuickPickStub.callCount, 1);
        // No further interactions should happen after cancellation
        assert.strictEqual(showOpenDialogStub.callCount, 0);
    });

    test('should handle user cancellation at main file selection', async () => {
        // Mock workspace folders
        workspaceFoldersStub.value([mockWorkspaceFolder]);

        // Mock user selections
        showQuickPickStub.onCall(0).resolves('nestJs'); // Project type

        // Mock findFiles to return some files
        const mockFile = vscode.Uri.file('/test/workspace/src/main.ts');
        findFilesStub.onCall(0).resolves([mockFile]); // For main file search
        findFilesStub.onCall(1).resolves([vscode.Uri.file('/test/workspace/.env')]); // For env file search


        // Mock user cancelling main file selection via QuickPick
        showQuickPickStub.onCall(1).resolves(undefined); // User cancelled main file selection
        await startReplCmd();

        // Verify the flow stopped after main file selection cancellation
        assert.strictEqual(showQuickPickStub.callCount, 2); // Project type + main file
        assert.strictEqual(showOpenDialogStub.callCount, 0);
    });

    test(`Should start the REPL successfully`, async () => {
        workspaceFoldersStub.value([mockWorkspaceFolder]);
        const mockFile = { label: 'src/main.ts', uri: vscode.Uri.file('/test/workspace/src/main.ts') };
        findFilesStub.onCall(0).resolves([mockFile]); // For main file search
        findFilesStub.onCall(1).resolves([mockFile]); // For env file search
        showQuickPickStub.onCall(0).resolves("nestJs");
        showQuickPickStub.onCall(1).resolves(mockFile);
        showQuickPickStub.onCall(2).resolves({
            label: "None",
            uri: vscode.Uri.file('None')
        });

        startReplStub.resolves([true, undefined])
        await startReplCmd();
        assert.strictEqual(showQuickPickStub.calledThrice, true);
        assert.strictEqual(showInformationMessageStub.calledWith('REPL started for /test/workspace/src/main.ts'), true);
    });
});