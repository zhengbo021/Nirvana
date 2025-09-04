export type DI = "NestJs" | "None" | "Other";
export type ReplContext = {
  workingDirectory: string;
  diInUse: {
    di: DI;
    nestJsMainModule?: string;
  };
  envFilePath?: string;
  extensionPath?: string;
};
export type ReplStartsDetails = {
  suc: boolean;
  message: string;
};

export interface REPL {
  init(): Promise<["OK" | "ERROR", string?]>;
  eval(code: string): Promise<void>;
  status(): Promise<"ready" | "loading" | "reloading" | "disconnected">;
  close(): Promise<void>;
}
