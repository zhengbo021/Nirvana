import { DI, REPL, ReplContext, ReplStartsDetails } from "./types";
import * as nestJsStarter from "./starters/nestjs/nestjsStarter";
import { appendNewLine } from "../util/nirvanaOutput";

let repl: REPL = null as any;

function getStarter(
  context: ReplContext,
): (context: ReplContext) => Promise<REPL> {
  switch (context.diInUse.di) {
    case "NestJs":
      return nestJsStarter.start;
    case "Other":
      return async () => {
        throw new Error("Not implemented");
      };
    case "None":
      return async () => {
        throw new Error("Not implemented");
      };
    default:
      return async () => {
        throw new Error("Not implemented");
      };
  }
}

export async function startRepl(
  context: ReplContext,
): Promise<ReplStartsDetails> {
  const starter = getStarter(context);
  const replInstance = await starter(context);
  const [initResult, initError] = await replInstance.init();
  appendNewLine(`Repl start result: ${initResult}, err: ${initError}`);
  repl = replInstance as any;
  return {
    suc: initResult === "OK",
    message: initError ?? "Repl started successfully",
  };
}

type ReplEvalContext = {
  filesToImport: string[];
};

export async function replEval(code: string, context: ReplEvalContext) {}
