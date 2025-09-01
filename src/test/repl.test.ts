import * as repl from "../repl/repl";
import assert from "assert";

const nestJsProjectFolder =
  "/Users/zhengma/Desktop/code/nirvana/nirvana/test-projects/nestjs";
suite("Repl tests", () => {
  test("Should load env file", async () => {
    const rs = await repl.startRepl({
      diInUse: {
        di: "None",
      },
      workingDirectory: nestJsProjectFolder,
      envFilePath: nestJsProjectFolder + "/.dev.env",
    });
    assert.ok(rs);
    assert.strictEqual(rs.suc, true);
  });
});
