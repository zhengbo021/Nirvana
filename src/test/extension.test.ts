import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as extension from '../extension';

suite('Extension Tests', () => {
	let registerCommandStub: sinon.SinonStub;
	let context: vscode.ExtensionContext;
	let mockDisposables: vscode.Disposable[];
	let subscriptionsPushSpy: sinon.SinonSpy;

	setup(() => {
		// Stub the vscode.commands.registerCommand
		registerCommandStub = sinon.stub(vscode.commands, 'registerCommand');

		// Create mock disposables that will be returned by registerCommand
		mockDisposables = [
			{ dispose: sinon.stub() } as vscode.Disposable,
			{ dispose: sinon.stub() } as vscode.Disposable,
			{ dispose: sinon.stub() } as vscode.Disposable
		];

		// Make registerCommand return the mock disposables in sequence
		registerCommandStub.onCall(0).returns(mockDisposables[0]);
		registerCommandStub.onCall(1).returns(mockDisposables[1]);
		registerCommandStub.onCall(2).returns(mockDisposables[2]);

		// Create a mock context with a subscriptions array we can spy on
		const mockSubscriptions: vscode.Disposable[] = [];
		subscriptionsPushSpy = sinon.spy(mockSubscriptions, 'push');

		// Create a partial mock context with just the properties we need
		context = {
			subscriptions: mockSubscriptions
		} as unknown as vscode.ExtensionContext;
	});

	teardown(() => {
		sinon.restore();
	});

	test('should register all commands and add them to subscriptions', () => {
		// Act: activate the extension
		extension.activate(context);

		// Assert: verify that all expected commands were registered
		const expectedCommands = [
			"Nirvana.startRepl",
			"Nirvana.stopRepl",
			"Nirvana.openOutput"
		];

		// Check that registerCommand was called for each expected command
		assert.strictEqual(registerCommandStub.callCount, expectedCommands.length,
			`Expected ${expectedCommands.length} commands to be registered, but ${registerCommandStub.callCount} were registered`);

		expectedCommands.forEach((cmd, index) => {
			const call = registerCommandStub.getCall(index);
			assert.ok(call.calledWith(cmd, sinon.match.func),
				`Expected command '${cmd}' to be registered with a function`);
		});

		// Assert: verify that all disposables were added to context.subscriptions
		assert.strictEqual(context.subscriptions.length, expectedCommands.length,
			`Expected ${expectedCommands.length} disposables in subscriptions, but found ${context.subscriptions.length}`);

		assert.strictEqual(subscriptionsPushSpy.callCount, expectedCommands.length,
			`Expected subscriptions.push to be called ${expectedCommands.length} times, but was called ${subscriptionsPushSpy.callCount} times`);

		// Verify each disposable was pushed to subscriptions
		mockDisposables.forEach((disposable, index) => {
			assert.strictEqual(context.subscriptions[index], disposable,
				`Expected disposable ${index} to match the one returned by registerCommand`);
			assert.ok(subscriptionsPushSpy.getCall(index).calledWith(disposable),
				`Expected subscriptions.push to be called with disposable ${index}`);
		});
	});

	test('should call registerCommand with correct function types', () => {
		// Act: activate the extension
		extension.activate(context);

		// Assert: verify that the second argument to registerCommand is a function
		for (let i = 0; i < registerCommandStub.callCount; i++) {
			const call = registerCommandStub.getCall(i);
			assert.strictEqual(typeof call.args[1], 'function',
				`Expected second argument of registerCommand call ${i} to be a function`);
		}
	});

	test('should handle context subscriptions correctly', () => {
		// Arrange: ensure we start with empty subscriptions
		assert.strictEqual(context.subscriptions.length, 0, 'Subscriptions should start empty');

		// Act: activate the extension
		extension.activate(context);

		// Assert: verify the correct number of items were added to subscriptions
		assert.strictEqual(context.subscriptions.length, 3, 'Should have 3 disposables in subscriptions');

		// Verify each subscription is a disposable with a dispose method
		context.subscriptions.forEach((disposable, index) => {
			assert.ok(disposable, `Subscription ${index} should exist`);
			assert.strictEqual(typeof disposable.dispose, 'function',
				`Subscription ${index} should have a dispose function`);
		});
	});
});