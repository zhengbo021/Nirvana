import * as assert from 'assert';
import { convertLetAndConstToVar } from '../../utils/tsSourceCodeUtils';

suite('Advanced Code Transformation Test Suite', () => {

    test('Should convert let to var in variable declarations', async () => {
        const input = 'let name = "John";';
        const result = await convertLetAndConstToVar(input);
        assert.ok(result != null)
        assert.ok(result.includes('var name = "John"'), `Expected var declaration, got: ${result}`);
    });

    test('Should convert const to var in variable declarations', async () => {
        const input = 'const age = 30;';
        const result = await convertLetAndConstToVar(input);
        assert.ok(result != null)
        assert.ok(result.includes('var age = 30'), `Expected var declaration, got: ${result}`);
    });

    test('Should not convert let/const in strings', async () => {
        const input = 'console.log("let me see const values");';
        const result = await convertLetAndConstToVar(input);
        // The string content should remain unchanged
        assert.ok(result != null)
        assert.ok(result.includes('"let me see const values"'), `String content should be preserved: ${result}`);
    });

    test('Should not convert let/const in comments', async () => {
        const input = '/* let const comment */ var x = 1;';
        const result = await convertLetAndConstToVar(input);
        // Comments should be preserved and var should remain var
        assert.ok(result != null)
        assert.ok(result.includes('var x = 1'), `Variable declaration should be preserved: ${result}`);
        assert.ok(result.includes('let const comment'), `Comment should be preserved: ${result}`);
    });

    test('Should handle multiple variable declarations', async () => {
        const input = 'let a = 1, b = 2;';
        const result = await convertLetAndConstToVar(input);
        assert.ok(result != null)
        assert.ok(result.includes('var a = 1, b = 2'), `Expected var declarations, got: ${result}`);
    });

    test('Should handle destructuring assignments', async () => {
        const input = 'let {name, age} = person;';
        const result = await convertLetAndConstToVar(input);
        assert.ok(result != null)
        assert.ok(result.includes('var { name, age } = person') || result.includes('var {name, age} = person'), `Expected var destructuring, got: ${result}`);
    });

    test('Should handle const arrow functions', async () => {
        const input = 'const add = (a, b) => a + b;';
        const result = await convertLetAndConstToVar(input);
        assert.ok(result != null)
        assert.ok(result.includes('var add = (a, b) => a + b'), `Expected var arrow function, got: ${result}`);
    });

    test('Should handle complex mixed declarations', async () => {
        const input = 'let x = 1; const y = 2; var z = 3;';
        const result = await convertLetAndConstToVar(input);
        // Should convert let and const to var, leave existing var alone
        assert.ok(result != null)
        assert.ok(result.includes('var x = 1'), `Expected var x, got: ${result}`);
        assert.ok(result.includes('var y = 2'), `Expected var y, got: ${result}`);
        assert.ok(result.includes('var z = 3'), `Expected var z to remain, got: ${result}`);
    });

    test('Should handle empty input', async () => {
        const input = '';
        const result = await convertLetAndConstToVar(input);
        assert.ok(result != null)
        assert.strictEqual(result.trim(), '', 'Empty input should return empty output');
    });
});
