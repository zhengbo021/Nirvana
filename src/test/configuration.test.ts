import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    getConvertLetConstToVar,
    setConvertLetConstToVar,
    toggleConvertLetConstToVar,
    getConfigurationOptions
} from '../configuration';

suite('Configuration Test Suite', () => {
    vscode.window.showInformationMessage('Start configuration tests.');

    test('Should get default convertLetConstToVar value', () => {
        const defaultValue = getConvertLetConstToVar();
        assert.strictEqual(typeof defaultValue, 'boolean');
    });

    test('Should be able to set convertLetConstToVar value', async () => {
        // Set to true
        await setConvertLetConstToVar(true);
        let currentValue = getConvertLetConstToVar();
        assert.strictEqual(currentValue, true);

        // Set to false
        await setConvertLetConstToVar(false);
        currentValue = getConvertLetConstToVar();
        assert.strictEqual(currentValue, false);
    });

    test('Should toggle convertLetConstToVar value', async () => {
        // Get current value
        const initialValue = getConvertLetConstToVar();

        // Toggle value
        const newValue = await toggleConvertLetConstToVar();

        // Verify toggle worked
        assert.strictEqual(newValue, !initialValue);
        assert.strictEqual(getConvertLetConstToVar(), newValue);

        // Toggle back to restore original state
        await toggleConvertLetConstToVar();
        assert.strictEqual(getConvertLetConstToVar(), initialValue);
    });

    test('Should return configuration options', () => {
        const options = getConfigurationOptions();
        assert.strictEqual(Array.isArray(options), true);
        assert.strictEqual(options.length > 0, true);

        // Check that the convertLetConstToVar option exists
        const convertLetConstOption = options.find((opt: any) => opt.key === 'convertLetConstToVar');
        assert.strictEqual(convertLetConstOption !== undefined, true);
        assert.strictEqual(typeof convertLetConstOption?.getCurrentValue, 'function');
        assert.strictEqual(typeof convertLetConstOption?.toggle, 'function');
    });
});
