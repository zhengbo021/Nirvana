// Simple assignment expression
const assignExpression = 1 + 1;

// Object literal spanning multiple lines
const objAssignExpression = {
    a: 2343,
    b: 23423,
    c: 234234
}

// Array with chained calls
const arrayAssignExpression = [1, 2, 3]
    .map(x => x + 1)
    .filter(x => x % 2 === 0)
    .join(',');

// Template literal with embedded expression and newline
const greeting = `Hello ${"World"}!
This is a multiline template literal.`;

// Arrow functions / concise and block bodies
const add = (a: number, b: number) => a + b;
const sumAndLog = (a: number, b: number) => {
    const s = a + b;
    console.log('sum:', s);
    return s;
}

// Classic function with multiple statements (logical block)
function computeComplex(a: number) {
    const x = a * 2;
    const y = x + 10;
    const z = Math.sqrt(y);
    return { x, y, z };
}

// Immediately-invoked function expression (IIFE)
(function init() {
    const initialized = true;
    // some initialization logic
})();

// Arrow IIFE
(() => {
    const tmp = 'temp';
    console.log(tmp);
})();

// Async/await and try/catch/finally
async function fetchData(url: string) {
    try {
        const response = await Promise.resolve({ ok: true, data: { value: 42 } });
        if (!response.ok) throw new Error('Network error');
        return response.data;
    } catch (e) {
        console.error('fetch failed', e);
        return null;
    } finally {
        // cleanup
    }
}

// Generator example
function* idGenerator() {
    let id = 0;
    while (true) {
        yield ++id;
    }
}

// Class with methods and nested closures
class MyCounter {
    private count = 0;

    increment() {
        this.count++;
        const log = () => console.log('count now', this.count);
        log();
    }

    async incrementAsync() {
        await Promise.resolve();
        this.increment();
    }
}

// For / while / do-while / switch blocks
for (let i = 0; i < 3; i++) {
    console.log('for', i);
}

let j = 0;
while (j < 2) {
    console.log('while', j);
    j++;
}

let k = 0;
do {
    console.log('do-while', k);
    k++;
} while (k < 1);

let level = 2;
switch (level) {
    case 1:
        console.log('one');
        break;
    case 2:
        console.log('two');
        break;
    default:
        console.log('other');
}

// Try a labeled statement and break
outerLoop: for (let m = 0; m < 3; m++) {
    for (let n = 0; n < 3; n++) {
        if (n === 1) break outerLoop;
    }
}

// Higher order function, callback and chained call expression
const numbers = [10, 20, 30, 40];
const processed = numbers
    .map(n => n / 10)
    .filter(Boolean)
    .reduce((acc, v) => acc + v, 0);

// Interface, type alias and enum (TypeScript features)
interface Person {
    name: string;
    age?: number;
}

type ID = string | number;

enum Color {
    Red,
    Green,
    Blue
}

const p: Person = { name: 'Alice', age: 30 };
const identifier: ID = 'id-123';
const c = Color.Green;

// Exported function (top-level)
export function exportedUtil(x: number) {
    const a = x + 1;
    const b = a * 2;
    return b;
}

// A block of consecutive statements to test grouping by proximity
const proxA = 1;
const proxB = 2;
const proxC = 3;
const proxSum = proxA + proxB + proxC;

// Complex object with methods and nested object
const complexObj = {
    id: 1,
    nested: {
        a: 1,
        b: () => ({ ok: true })
    },
    async compute() {
        return await Promise.resolve(this.id + 10);
    }
};

// End marker comment for selection tests
// --- END OF TEST SNIPPETS ---

