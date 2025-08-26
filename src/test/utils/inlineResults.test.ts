import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as inlineResults from '../../utils/inlineResults';

suite('InlineResults Test Suite', () => {
    let mockEditor: any;
    let mockDocument: any;
    let mockRange: vscode.Range;
    let mockPosition: vscode.Position;
    let mockDecorationType: any;
    let sandbox: sinon.SinonSandbox;
    let createDecorationStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Mock Position
        mockPosition = new vscode.Position(0, 0);

        // Mock Range
        mockRange = new vscode.Range(mockPosition, mockPosition);

        // Mock TextLine
        const mockTextLine = {
            text: 'const x = 1 + 1;',
            range: mockRange,
            lineNumber: 0,
            isEmptyOrWhitespace: false
        };

        // Mock TextDocument
        mockDocument = {
            getText: sandbox.stub().returns('const x = 1 + 1;'),
            lineAt: sandbox.stub().returns(mockTextLine),
            positionAt: sandbox.stub().callsFake((offset: number) => new vscode.Position(0, offset)),
            offsetAt: sandbox.stub().returns(0)
        };

        // Mock TextEditor
        mockEditor = {
            document: mockDocument,
            selection: {
                isEmpty: true,
                active: mockPosition
            },
            setDecorations: sandbox.stub()
        };

        // Mock TextEditorDecorationType
        mockDecorationType = {
            dispose: sandbox.stub()
        };

        // Stub vscode.window.createTextEditorDecorationType
        createDecorationStub = sandbox.stub(vscode.window, 'createTextEditorDecorationType').returns(mockDecorationType);
    });

    teardown(() => {
        sandbox.restore();
        inlineResults.clearAllInlineResults();
    });

    suite('showInlineResult', () => {
        test('should display inline result with proper formatting', () => {
            const result = '2';

            inlineResults.showInlineResult(mockEditor, mockRange, result);

            assert.ok(createDecorationStub.calledOnce);

            const decorationConfig = createDecorationStub.getCall(0).args[0];
            assert.strictEqual(decorationConfig.after.contentText, ' => 2');
            assert.strictEqual(decorationConfig.after.fontStyle, 'italic');
            assert.strictEqual(decorationConfig.after.margin, '0 0 0 1em');

            assert.ok(mockEditor.setDecorations.calledOnce);
            const [decorationType, ranges] = mockEditor.setDecorations.getCall(0).args;
            assert.strictEqual(decorationType, mockDecorationType);
            assert.strictEqual(ranges.length, 1);
        });

        test('should format long results correctly', () => {
            const longResult = 'a'.repeat(150); 

            inlineResults.showInlineResult(mockEditor, mockRange, longResult);

            const decorationConfig = createDecorationStub.getCall(0).args[0];
            const contentText = decorationConfig.after.contentText;

            assert.ok(contentText.includes('...'));
            // ' => ' (4 chars) + 100 chars + '...' (3 chars) = 107 chars
            assert.ok(contentText.length <= 107);
        });

        test('should handle multiline results', () => {
            const multilineResult = 'line1\nline2\nline3';

            inlineResults.showInlineResult(mockEditor, mockRange, multilineResult);

            const decorationConfig = createDecorationStub.getCall(0).args[0];
            const contentText = decorationConfig.after.contentText;

            assert.ok(!contentText.includes('\n'));
            assert.strictEqual(contentText, ' => line1 line2 line3');
        });

        test('should clear previous decorations before showing new ones', () => {
            inlineResults.showInlineResult(mockEditor, mockRange, 'first');

            mockDecorationType.dispose.resetHistory();
            createDecorationStub.resetHistory();

            inlineResults.showInlineResult(mockEditor, mockRange, 'second');

            assert.ok(mockDecorationType.dispose.calledOnce);

            assert.ok(createDecorationStub.calledOnce);
        });

        test('should handle empty or null results', () => {
            inlineResults.showInlineResult(mockEditor, mockRange, '');

            const decorationConfig = createDecorationStub.getCall(0).args[0];
            assert.strictEqual(decorationConfig.after.contentText, ' => ');

            createDecorationStub.resetHistory();
            inlineResults.showInlineResult(mockEditor, mockRange, null as any);

            const decorationConfig2 = createDecorationStub.getCall(0).args[0];
            assert.strictEqual(decorationConfig2.after.contentText, ' => ');
        });
    });

    suite('showInlineError', () => {
        test('should display error with proper styling', () => {
            const error = 'ReferenceError: x is not defined';

            inlineResults.showInlineError(mockEditor, mockRange, error);

            assert.ok(createDecorationStub.calledOnce);

            const decorationConfig = createDecorationStub.getCall(0).args[0];
            assert.ok(decorationConfig.after.contentText.startsWith(' => Error: '));
            assert.strictEqual(decorationConfig.after.fontStyle, 'italic');

            assert.ok(decorationConfig.after.color instanceof vscode.ThemeColor);
        });

        test('should format long error messages', () => {
            const longError = 'Error: ' + 'a'.repeat(150);

            inlineResults.showInlineError(mockEditor, mockRange, longError);

            const decorationConfig = createDecorationStub.getCall(0).args[0];
            const contentText = decorationConfig.after.contentText;

            assert.ok(contentText.includes('...'));
        });

        test('should clear previous decorations before showing error', () => {
            inlineResults.showInlineResult(mockEditor, mockRange, 'result');

            mockDecorationType.dispose.resetHistory();
            createDecorationStub.resetHistory();

            inlineResults.showInlineError(mockEditor, mockRange, 'error');

            assert.ok(mockDecorationType.dispose.calledOnce);
        });
    });

    suite('clearInlineResults', () => {
        test('should dispose decorations for specific editor', () => {
            inlineResults.showInlineResult(mockEditor, mockRange, 'test');

            mockDecorationType.dispose.resetHistory();

            inlineResults.clearInlineResults(mockEditor);

            assert.ok(mockDecorationType.dispose.calledOnce);
        });

        test('should handle editor with no decorations', () => {
            assert.doesNotThrow(() => {
                inlineResults.clearInlineResults(mockEditor);
            });
        });
    });

    suite('clearAllInlineResults', () => {
        test('should dispose all decorations from all editors', () => {
            const mockEditor2 = {
                ...mockEditor,
                setDecorations: sandbox.stub()
            };

            inlineResults.showInlineResult(mockEditor, mockRange, 'result1');
            const firstDecoration = mockDecorationType;

            const secondDecoration = { dispose: sandbox.stub() };
            createDecorationStub.returns(secondDecoration);
            inlineResults.showInlineResult(mockEditor2, mockRange, 'result2');

            inlineResults.clearAllInlineResults();

            assert.ok(firstDecoration.dispose.calledOnce);
            assert.ok(secondDecoration.dispose.calledOnce);
        });
    });

    suite('onEditorClosed', () => {
        test('should clean up decorations when editor is closed', () => {
            inlineResults.showInlineResult(mockEditor, mockRange, 'test');

            mockDecorationType.dispose.resetHistory();

            inlineResults.onEditorClosed(mockEditor);

            assert.ok(mockDecorationType.dispose.calledOnce);
        });
    });

    suite('getCodeExecutionRange', () => {
        test('should return selection range when code is selected', () => {
            const selection = new vscode.Range(
                new vscode.Position(1, 0),
                new vscode.Position(1, 10)
            );
            mockEditor.selection = {
                isEmpty: false,
                active: selection.start,
                start: selection.start,
                end: selection.end
            };

            const result = inlineResults.getCodeExecutionRange(mockEditor, 'test code');

            assert.strictEqual(result, mockEditor.selection);
        });

        test('should return cursor line range when no selection', () => {
            mockEditor.selection = {
                isEmpty: true,
                active: new vscode.Position(2, 5)
            };

            // Mock lineAt for cursor position
            const mockLineAtCursor = {
                text: 'console.log("test");',
                range: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 19))
            };
            mockDocument.lineAt.withArgs(2).returns(mockLineAtCursor);

            const result = inlineResults.getCodeExecutionRange(mockEditor, 'test code');

            assert.deepStrictEqual(result, mockLineAtCursor.range);
        });

        test('should find code position in document when code matches', () => {
            const testCode = 'const x = 1';
            mockDocument.getText.returns('// comment\nconst x = 1 + 1;\n// more');
            mockDocument.positionAt.withArgs(11).returns(new vscode.Position(1, 0));
            mockDocument.positionAt.withArgs(22).returns(new vscode.Position(1, 11));

            const result = inlineResults.getCodeExecutionRange(mockEditor, testCode);

            assert.ok(result instanceof vscode.Range);
            assert.deepStrictEqual(result.start, new vscode.Position(1, 0));
            assert.deepStrictEqual(result.end, new vscode.Position(1, 11));
        });

        test('should handle code not found in document', () => {
            mockDocument.getText.returns('different code here');
            mockEditor.selection = {
                isEmpty: true,
                active: new vscode.Position(0, 0)
            };

            const mockLineAtCursor = {
                text: 'different code here',
                range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 19))
            };
            mockDocument.lineAt.withArgs(0).returns(mockLineAtCursor);

            const result = inlineResults.getCodeExecutionRange(mockEditor, 'not found code');

            assert.deepStrictEqual(result, mockLineAtCursor.range);
        });
    });

    suite('formatResult helper function', () => {
        test('should format results through showInlineResult', () => {
            inlineResults.showInlineResult(mockEditor, mockRange, '  \n  result  \n  ');

            let decorationConfig = createDecorationStub.getCall(0).args[0];
            assert.strictEqual(decorationConfig.after.contentText, ' => result');

            createDecorationStub.resetHistory();
            inlineResults.showInlineResult(mockEditor, mockRange, 'result    with    spaces');

            decorationConfig = createDecorationStub.getCall(0).args[0];
            assert.strictEqual(decorationConfig.after.contentText, ' => result with spaces');
        });
    });

    suite('auto-cleanup timing', () => {
        let clock: sinon.SinonFakeTimers;

        setup(() => {
            clock = sinon.useFakeTimers();
        });

        teardown(() => {
            clock.restore();
        });

        test('should auto-clear inline results after 30 seconds', () => {
            inlineResults.showInlineResult(mockEditor, mockRange, 'test');

            assert.ok(!mockDecorationType.dispose.called);

            clock.tick(30000);

            assert.ok(mockDecorationType.dispose.calledOnce);
        });

        test('should auto-clear inline errors after 60 seconds', () => {
            inlineResults.showInlineError(mockEditor, mockRange, 'error');

            assert.ok(!mockDecorationType.dispose.called);

            clock.tick(30000);
            assert.ok(!mockDecorationType.dispose.called);

            clock.tick(30000);
            assert.ok(mockDecorationType.dispose.calledOnce);
        });
    });
});
