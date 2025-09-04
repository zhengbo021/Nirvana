import * as repl from "../repl/repl";
import assert from "assert";
import * as nestjsStarter from "../repl/starters/nestjs/nestjsStarter";
import Sinon from "sinon";

const nestJsProjectFolder =
  "/Users/zhengma/Desktop/code/nirvana/nirvana/test-projects/nestjs";
suite("Repl tests", async () => {
  let nestJsStarterStub: Sinon.SinonStub;

  setup(() => {
    nestJsStarterStub = Sinon.stub(nestjsStarter, "start");
  });

  teardown(() => {
    Sinon.restore();
  });

  suiteTeardown(() => {
    Sinon.restore();
  });

  test("Should use correct starter", async () => {
    nestJsStarterStub.resolves({
      async init() {
        return ["OK", undefined];
      },
    });
    const rs = await repl.startRepl({
      diInUse: {
        di: "NestJs",
      },
      workingDirectory: nestJsProjectFolder,
      envFilePath: nestJsProjectFolder + "/.dev.env",
    });
    console.log(`res? ${JSON.stringify(rs)}`);
    assert.ok(rs);
    assert.strictEqual(rs.suc, true);
    assert.strictEqual(
      nestJsStarterStub.callCount,
      1,
      "The starter should be called once",
    );
  });
  test("Should load env file", async () => {
    const rs = await repl.startRepl({
      diInUse: {
        di: "NestJs",
      },
      workingDirectory: nestJsProjectFolder,
      envFilePath: nestJsProjectFolder + "/.dev.env",
    });
    assert.ok(rs);
    assert.strictEqual(rs.suc, false);
    assert.strictEqual(rs.message, "Not supported for now");
  });
});
