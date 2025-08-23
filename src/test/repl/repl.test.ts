import * as repl from '../../repl/repl';
import path from 'path';
import assert from 'assert';

const nestJsProjectPath = path.resolve(process.cwd(), 'test-projects/nestjs');

suite("Start repl tests", () => {
    test("Should fail on incorrect projectType", async () => {
        const [suc, err] = await repl.startRepl(nestJsProjectPath, "xxx" as any, ["/src/app.module.ts"])
        assert.strictEqual(suc, false);
        assert.strictEqual(err, "Unsupported project type xxx");
    });


    test("Should fail on incorrect nestjs main", async function () {
        this.timeout(20000);
        const [suc, err] = await repl.startRepl(nestJsProjectPath, 'nestJs', ["src/main.ts"], 5000);
        assert.strictEqual(suc, false);
        assert.strictEqual(err, "REPL failed to initialize properly");
    });

    test("Should succeed on correct nestjs main", async function () {
        this.timeout(20000); // Increased timeout  
        const [suc, err] = await repl.startRepl(nestJsProjectPath, 'nestJs', ["src/app.module.ts"]);
        assert.strictEqual(suc, true);
        assert.strictEqual(err, undefined);
    });
})


suite("NestJs REPL eval tests", function () {
    let replStarted = false;
    let startupError: string | undefined;

    suiteSetup(async function () {
        this.timeout(25000);
        console.log("🚀 Starting REPL for eval tests...");

        const [suc, err] = await repl.startRepl(nestJsProjectPath, 'nestJs', ["src/app.module.ts"]);
        replStarted = suc;
        startupError = err;

        if (suc) {
            console.log("✅ REPL started successfully for eval tests");
        } else {
            console.error(`❌ Failed to start REPL: ${err}`);
        }
    });

    suiteTeardown(function () {
        console.log("🛑 Cleaning up REPL...");
        repl.stopRepl();
    });

    test("Should start REPL successfully", function () {
        if (!replStarted) {
            throw new Error(`REPL failed to start: ${startupError}`);
        }
        assert.strictEqual(replStarted, true, "REPL should have started successfully");
    });

    test("Should eval successfully", async function () {
        this.timeout(10000);
        assert.ok(replStarted, "REPL should have started");
        const res = await repl.replEval("1 + 1", 5000);
        assert.strictEqual(res.trim(), "2");
    });

    test("Should timeout on long running eval", async function () {
        this.timeout(15000);
        assert.ok(replStarted, "REPL should have started");

        try {
            await repl.replEval("let timeout = setTimeout(() => { console.log('done'); }, 10000);", 3000);
            assert.fail("Expected timeout error");
        } catch (err: any) {
            assert.ok(err.message.includes("REPL evaluation timed out."));
        }
    });
});