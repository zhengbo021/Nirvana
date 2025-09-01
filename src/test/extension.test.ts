import sinon from "sinon";
import { activate } from "../extension";
import * as command from "../command";
import assert from "assert";

suite("Extension test", () => {
  let registerCommandsStub: sinon.SinonStub;

  setup(() => {
    registerCommandsStub = sinon.stub(command, "registerCommands");
  });

  teardown(() => {
    registerCommandsStub.restore();
  });

  suiteTeardown(() => {
    sinon.restore();
  });

  test("Should register commands at startup", async () => {
    activate({} as any);
    assert.ok(
      registerCommandsStub.calledOnce,
      "The registerCommands should be called",
    );
  });
});
