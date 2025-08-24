import assert from 'assert';
import * as generator from '../../repl/typeDefinitionGenerator'
import path from 'path';
import Sinon from 'sinon';
import * as vscode from 'vscode'

suite("Should not generate types for non nestJs project", () => {
    const nestJsProjectPath = path.resolve(process.cwd(), 'test-projects/nestjs');
    const generateTypeFilePath = vscode.Uri.file(path.join(nestJsProjectPath, '.vscode', 'nirvana-types.d.ts'));

    setup(() => {
    })

    teardown(() => {
    })

    suiteTeardown(() => {
        Sinon.restore();
    })

    test("Should not generate types for non nestJs project", async function () {
        await generator.cleanup(nestJsProjectPath)
        generator.generateTypeDefinitions(nestJsProjectPath, "javascript");
        const result = await generator.generateTypeDefinitions(nestJsProjectPath, "javascript");
        const fileExistsOnJavascript = await vscode.workspace.fs.stat(generateTypeFilePath).then(() => true, () => false);
        assert.strictEqual(fileExistsOnJavascript, false);
        assert.strictEqual(result, undefined);

        await generator.cleanup(nestJsProjectPath)
        await generator.generateTypeDefinitions(nestJsProjectPath, "typescript")
        const fileExistsOnTypescript = await vscode.workspace.fs.stat(generateTypeFilePath).then(() => true, () => false);
        assert.strictEqual(fileExistsOnTypescript, false);
    })

    test("Should generate types for nestJs project", async function () {
        await generator.cleanup(nestJsProjectPath)
        await generator.generateTypeDefinitions(nestJsProjectPath, "nestJs");
        const fileExistsOnNestJs = await vscode.workspace.fs.stat(generateTypeFilePath).then(() => true, () => false);
        assert.strictEqual(fileExistsOnNestJs, true);
        const fileContent = (await vscode.workspace.fs.readFile(generateTypeFilePath)).toString()
        assert.ok(fileContent != null && fileContent.length != 0);
        assert.ok(fileContent.includes("function get<T>(serviceClass: new (...args: any[]) => T): T;"))
        assert.ok(fileContent.includes("function comment(runner: () => void)"))
    })
})