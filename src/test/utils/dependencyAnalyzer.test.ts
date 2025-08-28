import * as assert from 'assert';
import * as vscode from 'vscode';
import { analyzeDependencies, convertToReplImports, isBuiltinModule } from '../../utils/dependencyAnalyzer';

suite("Dependency Analyzer Tests", () => {

    test("Should extract ES6 named imports", async () => {
        const mockDocument = createMockDocument(`
import { readFile, writeFile } from 'fs';

const content = readFile('./test.txt');
        `);

        const codeToExecute = `const content = readFile('./test.txt');`;

        const analysis = await analyzeDependencies(mockDocument, codeToExecute);

        assert.strictEqual(analysis.requiresImports.length, 1);

        const fsImport = analysis.requiresImports.find(imp => imp.moduleName === 'fs');
        assert.ok(fsImport);
        assert.strictEqual(fsImport.importType, 'named');
        assert.ok(fsImport.importedNames.includes('readFile'));
    });

    test("Should convert builtin modules to require", () => {
        const imports = [
            {
                moduleName: 'fs',
                importType: 'named' as const,
                importedNames: ['readFile'],
                originalStatement: "import { readFile } from 'fs';"
            }
        ];

        const result = convertToReplImports(imports);
        assert.strictEqual(result.trim(), "const { readFile } = require('fs');");
    });

    test("Should identify builtin modules", () => {
        assert.strictEqual(isBuiltinModule('fs'), true);
        assert.strictEqual(isBuiltinModule('path'), true);
        assert.strictEqual(isBuiltinModule('lodash'), false);
    });

    test("Should handle local TypeScript file imports", () => {
        const imports = [
            {
                moduleName: './main',
                importType: 'named' as const,
                importedNames: ['test'],
                originalStatement: "import { test } from './main';"
            }
        ];

        const result = convertToReplImports(imports);

        // Should include the new recursive cache clearing function
        assert.ok(result.includes('clearModuleCache'), "Should include cache clearing function");
        assert.ok(result.includes("('./main')"), "Should include module path");
        assert.ok(result.includes("const { test } = require('./main');"), "Should include require statement");
    });

    test("Should handle local TypeScript file imports with .ts extension", () => {
        const imports = [
            {
                moduleName: './utils.ts',
                importType: 'named' as const,
                importedNames: ['helper'],
                originalStatement: "import { helper } from './utils.ts';"
            }
        ];

        const result = convertToReplImports(imports);

        // Should include the new recursive cache clearing function
        assert.ok(result.includes('clearModuleCache'), "Should include cache clearing function");
        assert.ok(result.includes("('./utils.ts')"), "Should include module path");
        assert.ok(result.includes("const { helper } = require('./utils.ts');"), "Should include require statement");
    });

    test("Should resolve relative imports from src directory", () => {
        const imports = [
            {
                moduleName: './main',
                importType: 'named' as const,
                importedNames: ['test'],
                originalStatement: "import { test } from './main'"
            }
        ];

        const currentFilePath = '/path/to/project/src/repl-demo.ts';
        const result = convertToReplImports(imports, currentFilePath);

        // Should include the new recursive cache clearing function and resolve path correctly
        assert.ok(result.includes('clearModuleCache'), "Should include cache clearing function");
        assert.ok(result.includes("('./src/main')"), "Should resolve path correctly");
        assert.ok(result.includes("const { test } = require('./src/main');"), "Should include require statement");
    }); test("Should not modify node module imports with path resolution", () => {
        const imports = [
            {
                moduleName: 'express',
                importType: 'default' as const,
                importedNames: [],
                alias: 'express',
                originalStatement: "import express from 'express'"
            }
        ];

        const result = convertToReplImports(imports);

        assert.strictEqual(result.trim(), "const express = require('express');");
    });

    test("Should handle multiple relative imports with path resolution", () => {
        const imports = [
            {
                moduleName: './service',
                importType: 'named' as const,
                importedNames: ['AppService'],
                originalStatement: "import { AppService } from './service'"
            },
            {
                moduleName: './controller',
                importType: 'named' as const,
                importedNames: ['AppController'],
                originalStatement: "import { AppController } from './controller'"
            }
        ];

        const currentFilePath = '/path/to/project/src/main.ts';
        const result = convertToReplImports(imports, currentFilePath);

        assert.ok(result.includes("const { AppService } = require('./src/service');"));
        assert.ok(result.includes("const { AppController } = require('./src/controller');"));
    });

    test("Should handle namespace imports with path resolution", () => {
        const imports = [
            {
                moduleName: './utils',
                importType: 'namespace' as const,
                importedNames: [],
                alias: 'Utils',
                originalStatement: "import * as Utils from './utils'"
            }
        ];

        const currentFilePath = '/path/to/project/src/main.ts';
        const result = convertToReplImports(imports, currentFilePath);

        // Should include the new recursive cache clearing function and resolve path correctly
        assert.ok(result.includes('clearModuleCache'), "Should include cache clearing function");
        assert.ok(result.includes("('./src/utils')"), "Should resolve path correctly");
        assert.ok(result.includes("const Utils = require('./src/utils');"), "Should include require statement");
    }); test("Should include cache clearing for local modules", () => {
        const imports = [
            {
                moduleName: './main',
                importType: 'named' as const,
                importedNames: ['test'],
                originalStatement: "import { test } from './main'"
            }
        ];

        const currentFilePath = '/path/to/project/src/repl-demo.ts';
        const result = convertToReplImports(imports, currentFilePath);

        // Should include the new recursive cache clearing function
        assert.ok(result.includes('clearModuleCache'), "Should include cache clearing function");
        assert.ok(result.includes("('./src/main')"), "Should resolve path correctly");
        assert.ok(result.includes("const { test } = require('./src/main');"), "Should include require statement");
    });

    test("Should not include cache clearing for node modules", () => {
        const imports = [
            {
                moduleName: 'express',
                importType: 'default' as const,
                importedNames: [],
                alias: 'express',
                originalStatement: "import express from 'express'"
            }
        ];

        const result = convertToReplImports(imports);

        // Should not include cache clearing for node modules
        assert.ok(!result.includes("delete require.cache"));
        assert.strictEqual(result.trim(), "const express = require('express');");
    });

    test("Should handle dynamic imports with destructuring", () => {
        const imports = [
            {
                moduleName: './utils',
                importType: 'dynamic' as const,
                importedNames: ['testUtils'],
                originalStatement: "const { testUtils } = await import('./utils')"
            }
        ];

        const currentFilePath = '/path/to/project/src/repl-demo.ts';
        const result = convertToReplImports(imports, currentFilePath);

        // Should include the new recursive cache clearing function and convert to require with destructuring
        assert.ok(result.includes('clearModuleCache'), "Should include cache clearing function");
        assert.ok(result.includes("('./src/utils')"), "Should resolve path correctly");
        assert.ok(result.includes("const { testUtils } = require('./src/utils');"), "Should include require statement");
    });

    test("Should handle dynamic imports without destructuring", () => {
        const imports = [
            {
                moduleName: './module',
                importType: 'dynamic' as const,
                importedNames: ['moduleDefault'],
                originalStatement: "const moduleDefault = await import('./module')"
            }
        ];

        const result = convertToReplImports(imports);

        // Should convert to require without destructuring when no braces in original
        assert.ok(result.includes("const moduleDefault = require('./module');"));
    });
});

// Simplified mock document helper
function createMockDocument(content: string): vscode.TextDocument {
    return {
        getText: () => content,
        fileName: 'test.ts',
        languageId: 'typescript'
    } as vscode.TextDocument;
}
