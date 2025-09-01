export type DI = "NestJs" | "None" | "Other";
export type ReplContext = {
  workingDirectory: string;
  diInUse: {
    di: DI;
    nestJsMainModule?: string;
  };
  envFilePath?: string;
};

export type ReplStartsDetails = {
  suc: boolean;
  message: string;
};
export async function startRepl(
  context: ReplContext,
): Promise<ReplStartsDetails> {
  return {
    suc: true,
    message: "Repl started successfully",
  };
}

type ReplEvalContext = {
  filesToImport: string[];
};

export async function replEval(code: string, context: ReplEvalContext) {}
