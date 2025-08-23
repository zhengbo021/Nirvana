import assert from 'assert';
import * as cmd from '../command';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as repl from '../repl/repl';

suite('command tests', () => {
    test('commands should be registered', () => {
        assert.strictEqual(cmd.commands.length, 3);
        assert.strictEqual(cmd.commands[0][0], "Nirvana.startRepl");
        assert.strictEqual(typeof cmd.commands[0][1], 'function');
    });
});

suite('start repl tests', () => {
    let showErrorMessageStub: sinon.SinonStub;
    let showWarningMessageStub: sinon.SinonStub;
    let workspaceFoldersStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let startReplStub: sinon.SinonStub;
    const startReplCmd = cmd.commands[0][1];

    setup(() => {
        // Create stubs for VS Code APIs
        showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
        workspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders');
        showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');

        // Stub the repl.startRepl function to avoid actually starting a REPL during tests
        startReplStub = sinon.stub(repl, 'startRepl');
        // Default behavior: return success
        startReplStub.resolves([true, undefined]);
    });

    teardown(() => {
        // Restore all stubs after each test
        showErrorMessageStub.restore();
        showWarningMessageStub.restore();
        workspaceFoldersStub.restore();
        showInformationMessageStub.restore();
        startReplStub.restore();
        sinon.restore();
    });

    test('should fail when no workspace folder setup', async () => {
        // Mock no workspace folders
        workspaceFoldersStub.value(undefined);

        await startReplCmd();

        // Verify that showErrorMessage was called with the expected message
        assert.strictEqual(showErrorMessageStub.calledOnce, true);
        assert.strictEqual(showErrorMessageStub.calledWith('No workspace folder open.'), true);
    });

    test('should fail when workspace folders array is empty', async () => {
        // Mock empty workspace folders array
        workspaceFoldersStub.value([]);

        await startReplCmd();

        // Verify that showErrorMessage was called with the expected message
        assert.strictEqual(showErrorMessageStub.calledOnce, true);
        assert.strictEqual(showErrorMessageStub.calledWith('No workspace folder open.'), true);
    });

    test(`should fail when the config is missing`, async () => {
        const testProjectPath = path.resolve(process.cwd(), 'test-projects/nestjs');
        const workspaceFolder = { uri: vscode.Uri.file(testProjectPath) };
        //rename the nirvana.json file to nirvana.json.bak if exists.
        const configFilePath = path.join(workspaceFolder.uri.fsPath, 'nirvana.json');
        const newConfigFilePath = path.join(workspaceFolder.uri.fsPath, 'nirvana.json.bak');

        if (fs.existsSync(configFilePath)) {
            fs.renameSync(configFilePath, newConfigFilePath);
        }

        // Mock a workspace folder
        workspaceFoldersStub.value([workspaceFolder]);

        await startReplCmd();

        // Verify that showWarningMessage was called with the expected message
        assert.strictEqual(showWarningMessageStub.calledOnce, true);
        assert.strictEqual(showWarningMessageStub.calledWith('The nirvana.json config file not found in the root folder.'), true);

        //rename back the config file.
        if (fs.existsSync(newConfigFilePath)) {
            fs.renameSync(newConfigFilePath, configFilePath);
        }
    });

    test(`Should fail when the config is incorrect`, async () => {
        const testProjectPath = path.resolve(process.cwd(), 'test-projects/nestjs');
        const workspaceFolder = { uri: vscode.Uri.file(testProjectPath) };
        // Mock a workspace folder
        workspaceFoldersStub.value([workspaceFolder]);

        //rename the config file to nirvana.json.bak first
        //and then create a new config file to the workspace.
        const configFilePath = path.join(workspaceFolder.uri.fsPath, 'nirvana.json');
        const bacConfigFilePath = path.join(workspaceFolder.uri.fsPath, 'nirvana.json.bak');
        if (fs.existsSync(configFilePath)) {
            fs.renameSync(configFilePath, bacConfigFilePath);
        }
        fs.writeFileSync(configFilePath, JSON.stringify({ projectType: 'incorrect_type' }));

        await startReplCmd();
        // Verify that showErrorMessage was called with the expected message
        assert.strictEqual(showErrorMessageStub.calledOnce, true);
        assert.ok(showErrorMessageStub.calledWith(sinon.match(/The value of the projectType in nirvana.json config file is wrong/)));

        fs.writeFileSync(configFilePath, JSON.stringify({ projectType: "nestJs", main: null }));
        await startReplCmd();
        assert.strictEqual(showErrorMessageStub.calledTwice, true);
        assert.ok(showErrorMessageStub.calledWith(sinon.match(/The value of main in nirvana.json config file is wrong. Should be the path of your project main file./)));

        // Clean up: remove the created file and restore the original if it existed
        if (fs.existsSync(configFilePath)) {
            fs.unlinkSync(configFilePath);
        }
        if (fs.existsSync(bacConfigFilePath)) {
            fs.renameSync(bacConfigFilePath, configFilePath);
        }
    });

    test(`Should fail on invalid main file`, async () => {
        const testProjectPath = path.resolve(process.cwd(), 'test-projects/nestjs');
        const workspaceFolder = { uri: vscode.Uri.file(testProjectPath) };
        // Mock a workspace folder
        workspaceFoldersStub.value([workspaceFolder]);

        // Mock repl.startRepl to return failure for invalid file
        startReplStub.resolves([false, 'File not found: src/invalid-file.ts']);

        //rename the config file to nirvana.json.bak first
        //and then create a new config file to the workspace.
        const configFilePath = path.join(workspaceFolder.uri.fsPath, 'nirvana.json');
        const bacConfigFilePath = path.join(workspaceFolder.uri.fsPath, 'nirvana.json.bak');
        if (fs.existsSync(configFilePath)) {
            fs.renameSync(configFilePath, bacConfigFilePath);
        }
        fs.writeFileSync(configFilePath, JSON.stringify({ projectType: "nestJs", main: "src/invalid-file.ts" }));

        await startReplCmd();

        // Verify that showErrorMessage was called with the expected message
        assert.strictEqual(showErrorMessageStub.calledOnce, true);
        assert.ok(showErrorMessageStub.calledWith(sinon.match(/Failed to start REPL for src\/invalid-file.ts/)));

        // Clean up: remove the created file and restore the original if it existed
        if (fs.existsSync(configFilePath)) {
            fs.unlinkSync(configFilePath);
        }
        if (fs.existsSync(bacConfigFilePath)) {
            fs.renameSync(bacConfigFilePath, configFilePath);
        }
    });

    test(`Should start the REPL successfully`, async () => {
        const testProjectPath = path.resolve(process.cwd(), 'test-projects/nestjs');
        const workspaceFolder = { uri: vscode.Uri.file(testProjectPath) };
        // Mock a workspace folder
        workspaceFoldersStub.value([workspaceFolder]);

        // Mock repl.startRepl to return success
        startReplStub.resolves([true, undefined]);

        //rename the config file to nirvana.json.bak first
        //and then create a new config file to the workspace.
        const configFilePath = path.join(workspaceFolder.uri.fsPath, 'nirvana.json');
        const bacConfigFilePath = path.join(workspaceFolder.uri.fsPath, 'nirvana.json.bak');
        if (fs.existsSync(configFilePath)) {
            fs.renameSync(configFilePath, bacConfigFilePath);
        }
        fs.writeFileSync(configFilePath, JSON.stringify({ projectType: "nestJs", main: "src/app.module.ts" }));

        await startReplCmd();

        // Verify that showInformationMessage was called with the expected message
        assert.strictEqual(showInformationMessageStub.calledTwice, true); // "Start repl" + "REPL started for..."
        assert.ok(showInformationMessageStub.calledWith("Start repl"));
        assert.ok(showInformationMessageStub.calledWith("REPL started for src/app.module.ts"));

        // Clean up: remove the created file and restore the original if it existed
        if (fs.existsSync(configFilePath)) {
            fs.unlinkSync(configFilePath);
        }
        if (fs.existsSync(bacConfigFilePath)) {
            fs.renameSync(bacConfigFilePath, configFilePath);
        }
    });
});