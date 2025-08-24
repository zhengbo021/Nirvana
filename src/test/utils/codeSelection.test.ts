import * as vscode from 'vscode';
import * as assert from 'assert';
import { getExecutableCode, highlightExecutableCode } from '../../utils/codeSelector';
import * as fs from 'fs';
import * as path from 'path';

// Read the test code file
const testCodePath = path.resolve(process.cwd(), 'test-projects/nestjs/codeSelectionTestCode.ts');
const testCode = fs.readFileSync(testCodePath, 'utf-8');

// Mock VS Code TextDocument
class MockTextDocument implements vscode.TextDocument {
    uri: vscode.Uri;
    fileName: string;
    isUntitled: boolean = false;
    languageId: string = 'typescript';
    version: number = 1;
    isDirty: boolean = false;
    isClosed: boolean = false;
    eol: vscode.EndOfLine = vscode.EndOfLine.LF;
    lineCount: number;
    encoding: string = 'utf8';

    private lines: string[];

    constructor(content: string, fileName: string = 'test.ts') {
        this.uri = vscode.Uri.file(fileName);
        this.fileName = fileName;
        this.lines = content.split('\n');
        this.lineCount = this.lines.length;
    }

    save(): Thenable<boolean> {
        return Promise.resolve(true);
    }

    lineAt(line: number): vscode.TextLine;
    lineAt(position: vscode.Position): vscode.TextLine;
    lineAt(lineOrPosition: number | vscode.Position): vscode.TextLine {
        const lineNum = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
        const text = this.lines[lineNum] || '';
        return {
            lineNumber: lineNum,
            text,
            range: new vscode.Range(lineNum, 0, lineNum, text.length),
            rangeIncludingLineBreak: new vscode.Range(lineNum, 0, lineNum + 1, 0),
            firstNonWhitespaceCharacterIndex: text.search(/\S/),
            isEmptyOrWhitespace: text.trim().length === 0
        };
    }

    offsetAt(position: vscode.Position): number {
        let offset = 0;
        for (let i = 0; i < position.line; i++) {
            offset += this.lines[i].length + 1; // +1 for newline
        }
        offset += position.character;
        return offset;
    }

    positionAt(offset: number): vscode.Position {
        let currentOffset = 0;
        for (let line = 0; line < this.lines.length; line++) {
            const lineLength = this.lines[line].length;
            if (currentOffset + lineLength >= offset) {
                return new vscode.Position(line, offset - currentOffset);
            }
            currentOffset += lineLength + 1; // +1 for newline
        }
        return new vscode.Position(this.lines.length - 1, this.lines[this.lines.length - 1].length);
    }

    getText(range?: vscode.Range): string {
        if (!range) {
            return this.lines.join('\n');
        }

        if (range.start.line === range.end.line) {
            return this.lines[range.start.line].substring(range.start.character, range.end.character);
        }

        let result = '';
        for (let line = range.start.line; line <= range.end.line; line++) {
            if (line === range.start.line) {
                result += this.lines[line].substring(range.start.character);
            } else if (line === range.end.line) {
                result += '\n' + this.lines[line].substring(0, range.end.character);
            } else {
                result += '\n' + this.lines[line];
            }
        }
        return result;
    }

    getWordRangeAtPosition(position: vscode.Position, regex?: RegExp): vscode.Range | undefined {
        return undefined;
    }

    validateRange(range: vscode.Range): vscode.Range {
        return range;
    }

    validatePosition(position: vscode.Position): vscode.Position {
        return position;
    }
}

// Mock VS Code TextEditor
class MockTextEditor implements vscode.TextEditor {
    document: vscode.TextDocument;
    selection: vscode.Selection;
    selections: vscode.Selection[];
    visibleRanges: vscode.Range[] = [];
    options: vscode.TextEditorOptions = {};
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.One;

    constructor(document: vscode.TextDocument, position: vscode.Position, selection?: vscode.Selection) {
        this.document = document;
        this.selection = selection || new vscode.Selection(position, position);
        this.selections = [this.selection];
    }

    edit(callback: (editBuilder: vscode.TextEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean> {
        return Promise.resolve(true);
    }

    insertSnippet(snippet: vscode.SnippetString, location?: vscode.Position | vscode.Range | readonly vscode.Position[] | readonly vscode.Range[], options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean> {
        return Promise.resolve(true);
    }

    setDecorations(decorationType: vscode.TextEditorDecorationType, rangesOrOptions: readonly vscode.Range[] | readonly vscode.DecorationOptions[]): void {
        // Mock implementation
    }

    revealRange(range: vscode.Range, revealType?: vscode.TextEditorRevealType): void {
        // Mock implementation
    }

    show(column?: vscode.ViewColumn): void {
        // Mock implementation
    }

    hide(): void {
        // Mock implementation
    }
}

// Helper function to find line number containing text
function findLineContaining(content: string, searchText: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchText)) {
            return i;
        }
    }
    return -1;
}

// Helper function to create editor at specific line
function createEditorAtLine(content: string, lineText: string, characterOffset: number = 0): MockTextEditor {
    const document = new MockTextDocument(content);
    const lineNumber = findLineContaining(content, lineText);
    assert.ok(lineNumber >= 0, `Could not find line containing: ${lineText}`);

    const position = new vscode.Position(lineNumber, characterOffset);
    return new MockTextEditor(document, position);
}

suite("Code Selection Tests", () => {

    test("Should extract simple assignment expression", async () => {
        const editor = createEditorAtLine(testCode, "const assignExpression = 1 + 1;");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("const assignExpression = 1 + 1;"), "Should extract the assignment expression");
    });

    test("Should extract multi-line object literal", async () => {
        const editor = createEditorAtLine(testCode, "const objAssignExpression = {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("const objAssignExpression = {"), "Should extract object assignment");
        assert.ok(result.includes("a: 2343"), "Should include object properties");
        assert.ok(result.includes("}"), "Should include closing brace");
    });

    test("Should extract array with chained method calls", async () => {
        const editor = createEditorAtLine(testCode, "const arrayAssignExpression = [1, 2, 3]");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("const arrayAssignExpression = [1, 2, 3]"), "Should extract array assignment");
        assert.ok(result.includes(".map(x => x + 1)"), "Should include chained map call");
        assert.ok(result.includes(".filter(x => x % 2 === 0)"), "Should include chained filter call");
        assert.ok(result.includes(".join(',');"), "Should include chained join call");
    });

    test("Should extract template literal with embedded expression", async () => {
        const editor = createEditorAtLine(testCode, 'const greeting = `Hello ${"World"}!');
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes('const greeting = `Hello ${"World"}!'), "Should extract template literal start");
        assert.ok(result.includes("This is a multiline template literal.`"), "Should include multiline content");
    });

    test("Should extract arrow function - concise body", async () => {
        const editor = createEditorAtLine(testCode, "const add = (a: number, b: number) => a + b;");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("const add = (a: number, b: number) => a + b;"), "Should extract concise arrow function");
    });

    test("Should extract arrow function - block body", async () => {
        const editor = createEditorAtLine(testCode, "const sumAndLog = (a: number, b: number) => {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("const sumAndLog = (a: number, b: number) => {"), "Should extract arrow function with block");
        assert.ok(result.includes("const s = a + b;"), "Should include function body");
        assert.ok(result.includes("console.log('sum:', s);"), "Should include console.log statement");
        assert.ok(result.includes("return s;"), "Should include return statement");
    });

    test("Should extract function declaration with multiple statements", async () => {
        const editor = createEditorAtLine(testCode, "function computeComplex(a: number) {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("function computeComplex(a: number) {"), "Should extract function declaration");
        assert.ok(result.includes("const x = a * 2;"), "Should include first statement");
        assert.ok(result.includes("const y = x + 10;"), "Should include second statement");
        assert.ok(result.includes("const z = Math.sqrt(y);"), "Should include third statement");
        assert.ok(result.includes("return { x, y, z };"), "Should include return statement");
    });

    test("Should extract IIFE (Immediately-Invoked Function Expression)", async () => {
        const editor = createEditorAtLine(testCode, "(function init() {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("(function init() {"), "Should extract IIFE start");
        assert.ok(result.includes("const initialized = true;"), "Should include IIFE body");
        // The AST correctly identifies and extracts IIFE as a complete expression
        assert.ok(result.length > 50, "Should extract meaningful IIFE content");
    });

    test("Should extract arrow IIFE", async () => {
        const editor = createEditorAtLine(testCode, "(() => {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("(() => {"), "Should extract arrow IIFE start");
        assert.ok(result.includes("const tmp = 'temp';"), "Should include arrow IIFE body");
        assert.ok(result.includes("console.log(tmp);"), "Should include console.log");
        // The AST correctly identifies and extracts arrow IIFE as a complete expression
        assert.ok(result.length > 40, "Should extract meaningful arrow IIFE content");
    });

    test("Should extract async function with try/catch/finally", async () => {
        const editor = createEditorAtLine(testCode, "async function fetchData(url: string) {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("async function fetchData(url: string) {"), "Should extract async function");
        assert.ok(result.includes("try {"), "Should include try block");
        assert.ok(result.includes("const response = await Promise.resolve"), "Should include await statement");
        assert.ok(result.includes("} catch (e) {"), "Should include catch block");
        assert.ok(result.includes("} finally {"), "Should include finally block");
    });

    test("Should extract generator function", async () => {
        const editor = createEditorAtLine(testCode, "function* idGenerator() {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("function* idGenerator() {"), "Should extract generator function");
        assert.ok(result.includes("let id = 0;"), "Should include generator body");
        assert.ok(result.includes("while (true) {"), "Should include while loop");
        assert.ok(result.includes("yield ++id;"), "Should include yield statement");
    });

    test("Should extract class declaration", async () => {
        const editor = createEditorAtLine(testCode, "class MyCounter {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("class MyCounter {"), "Should extract class declaration");
        assert.ok(result.includes("private count = 0;"), "Should include class property");
        assert.ok(result.includes("increment() {"), "Should include class method");
        assert.ok(result.includes("async incrementAsync() {"), "Should include async method");
    });

    test("Should extract single statement inside class method", async () => {
        const editor = createEditorAtLine(testCode, "this.count++;", 8); // Position within increment method
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("this.count++;"), "Should extract single statement inside method");
    });

    test("Should extract for loop", async () => {
        const editor = createEditorAtLine(testCode, "for (let i = 0; i < 3; i++) {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("for (let i = 0; i < 3; i++) {"), "Should extract for loop");
        assert.ok(result.includes("console.log('for', i);"), "Should include loop body");
    });

    test("Should extract while loop", async () => {
        const editor = createEditorAtLine(testCode, "while (j < 2) {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("while (j < 2) {"), "Should extract while loop");
        assert.ok(result.includes("console.log('while', j);"), "Should include loop body");
        assert.ok(result.includes("j++;"), "Should include increment");
    });

    test("Should extract do-while loop", async () => {
        const editor = createEditorAtLine(testCode, "do {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("do {"), "Should extract do-while loop");
        assert.ok(result.includes("console.log('do-while', k);"), "Should include loop body");
        assert.ok(result.includes("} while (k < 1);"), "Should include while condition");
    });

    test("Should extract switch statement", async () => {
        const editor = createEditorAtLine(testCode, "switch (level) {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("switch (level) {"), "Should extract switch statement");
        assert.ok(result.includes("case 1:"), "Should include case statements");
        assert.ok(result.includes("console.log('one');"), "Should include case body");
        assert.ok(result.includes("default:"), "Should include default case");
    });

    test("Should extract labeled statement with nested loops", async () => {
        const editor = createEditorAtLine(testCode, "outerLoop: for (let m = 0; m < 3; m++) {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("outerLoop: for (let m = 0; m < 3; m++) {"), "Should extract labeled statement");
        assert.ok(result.includes("for (let n = 0; n < 3; n++) {"), "Should include nested loop");
        assert.ok(result.includes("if (n === 1) break outerLoop;"), "Should include break with label");
    });

    test("Should extract method chaining expression", async () => {
        const editor = createEditorAtLine(testCode, "const processed = numbers");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("const processed = numbers"), "Should extract chaining start");
        assert.ok(result.includes(".map(n => n / 10)"), "Should include map call");
        assert.ok(result.includes(".filter(Boolean)"), "Should include filter call");
        assert.ok(result.includes(".reduce((acc, v) => acc + v, 0);"), "Should include reduce call");
    });

    test("Should extract interface declaration", async () => {
        const editor = createEditorAtLine(testCode, "interface Person {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("interface Person {"), "Should extract interface declaration");
        assert.ok(result.includes("name: string;"), "Should include interface properties");
        assert.ok(result.includes("age?: number;"), "Should include optional properties");
    });

    test("Should extract type alias", async () => {
        const editor = createEditorAtLine(testCode, "type ID = string | number;");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("type ID = string | number;"), "Should extract type alias");
    });

    test("Should extract enum declaration", async () => {
        const editor = createEditorAtLine(testCode, "enum Color {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("enum Color {"), "Should extract enum declaration");
        assert.ok(result.includes("Red,"), "Should include enum values");
        assert.ok(result.includes("Green,"), "Should include enum values");
        assert.ok(result.includes("Blue"), "Should include enum values");
    });

    test("Should extract exported function", async () => {
        const editor = createEditorAtLine(testCode, "export function exportedUtil(x: number) {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("export function exportedUtil(x: number) {"), "Should extract exported function");
        assert.ok(result.includes("const a = x + 1;"), "Should include function body");
        assert.ok(result.includes("const b = a * 2;"), "Should include function body");
        assert.ok(result.includes("return b;"), "Should include return statement");
    });

    test("Should extract logical block of consecutive statements", async () => {
        const editor = createEditorAtLine(testCode, "const proxB = 2;");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        // Should group consecutive related statements
        assert.ok(result.includes("const proxA = 1;"), "Should include previous statement in block");
        assert.ok(result.includes("const proxB = 2;"), "Should include current statement");
        assert.ok(result.includes("const proxC = 3;"), "Should include next statement in block");
        assert.ok(result.includes("const proxSum = proxA + proxB + proxC;"), "Should include related calculation");
    });

    test("Should extract complex object with methods", async () => {
        const editor = createEditorAtLine(testCode, "const complexObj = {");
        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("const complexObj = {"), "Should extract complex object");
        assert.ok(result.includes("id: 1,"), "Should include object properties");
        assert.ok(result.includes("nested: {"), "Should include nested object");
        assert.ok(result.includes("async compute() {"), "Should include async method");
        assert.ok(result.includes("return await Promise.resolve(this.id + 10);"), "Should include method body");
    });

    test("Should handle selection override", async () => {
        const document = new MockTextDocument(testCode);
        const startPos = new vscode.Position(1, 0);
        const endPos = new vscode.Position(1, 20);
        const selection = new vscode.Selection(startPos, endPos);
        const editor = new MockTextEditor(document, startPos, selection);

        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.strictEqual(result, document.getText(selection), "Should return selected text when selection is not empty");
    });

    test("Should fallback to current line when AST fails", async () => {
        // Create editor with invalid TypeScript to force AST failure
        const invalidCode = "const invalid = {{{";
        const document = new MockTextDocument(invalidCode);
        const position = new vscode.Position(0, 5);
        const editor = new MockTextEditor(document, position);

        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.strictEqual(result, "const invalid = {{{", "Should fallback to current line text");
    });

    test("Should handle empty file", async () => {
        const document = new MockTextDocument("");
        const position = new vscode.Position(0, 0);
        const editor = new MockTextEditor(document, position);

        const result = await getExecutableCode(editor);
        assert.notStrictEqual(result, null, "Result should not be null");
        assert.strictEqual(result, "", `Should return empty string for empty file. actualResult: ${result}`);
    });

    test("Should handle cursor at end of file", async () => {
        const document = new MockTextDocument("const test = 1;");
        const position = new vscode.Position(0, 15); // At end of line
        const editor = new MockTextEditor(document, position);

        const result = await getExecutableCode(editor);
        assert.ok(result, "Result should not be null");
        assert.ok(result.includes("const test = 1;"), `Should extract the statement.`);
    });
});