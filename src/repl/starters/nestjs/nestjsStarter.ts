import { REPL, ReplContext } from "../../types";
import fs from "fs";

import path from "path";
import { appendNewLine } from "../../../util/nirvanaOutput";

const extensionFolderName = ".nirvana";
const typeDefFilename = "nestjsTypeDef.d.ts";
const hrmEntryFileName = "hmrEntry.ts";

// Get the extension root path from the context
let extensionPath: string = "";

function setExtensionPath(extPath: string) {
  extensionPath = extPath;
}

async function findMainModuleName(mainModuleFilePath: string): Promise<string> {
  return "AppModule";
}

async function createHrmEntryFile(
  workingDirectory: string,
  mainModuleFilePath: string,
): Promise<string | undefined> {
  const moduleName = await findMainModuleName(mainModuleFilePath);
  const templatePath = path.join(
    extensionPath,
    "dist",
    "repl",
    "starters",
    "nestjs",
    "nestJsHmrEntry.ts.template",
  );

  if (!fs.existsSync(templatePath)) {
    return `Template file not found: ${templatePath}`;
  }

  const template = fs.readFileSync(templatePath, "utf-8");

  let processedTemplate = template.replaceAll("###AppModule", moduleName);
  processedTemplate = processedTemplate.replaceAll(
    "###AppModulePath",
    mainModuleFilePath,
  );

  const nirvanaFolder = `${workingDirectory}/${extensionFolderName}`;
  if (!fs.existsSync(nirvanaFolder)) {
    fs.mkdirSync(nirvanaFolder);
  }
  const entryFilePath = `${nirvanaFolder}/${hrmEntryFileName}`;
  fs.writeFileSync(entryFilePath, processedTemplate, "utf-8");
  return undefined;
}

async function copyTypeDefFilesToTheFolder(workingDirectory: string) {
  const typeDefPath = path.join(
    extensionPath,
    "dist",
    "repl",
    "starters",
    "nestjs",
    "nestjsTypeDef.d.ts",
  );

  if (fs.existsSync(typeDefPath)) {
    fs.copyFileSync(
      typeDefPath,
      `${workingDirectory}/${extensionFolderName}/${typeDefFilename}`,
    );
  }
}

async function configUserTsConfig(workingDirectory: string) {
  const tsConfigPath = `${workingDirectory}/tsconfig.json`;
  if (!fs.existsSync(tsConfigPath)) {
    return;
  }
  const tsConfigContent = fs.readFileSync(tsConfigPath, "utf-8");
  let tsConfig: any;
  try {
    tsConfig = JSON.parse(tsConfigContent);
  } catch (e: any) {
    appendNewLine(`Failed to parse tsconfig.json: ${e.toString()}`);
    return;
  }
  if (!tsConfig.include) {
    tsConfig.include = [];
  }
  if (!tsConfig.include.includes(extensionFolderName)) {
    tsConfig.include.push(`${extensionFolderName}/**/*`);
  }

  if (!tsConfig.include.includes("**/*")) {
    tsConfig.include.push("**/*");
  }

  fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2), "utf-8");
}

async function addNirvanaFolderToGitIgnore(workingDirectory: string) {
  const gitIgnorePath = `${workingDirectory}/.gitignore`;
  let gitIgnoreContent = "";
  if (fs.existsSync(gitIgnorePath)) {
    gitIgnoreContent = fs.readFileSync(gitIgnorePath, "utf-8");
  }
  if (!gitIgnoreContent.includes(extensionFolderName)) {
    if (gitIgnoreContent && !gitIgnoreContent.endsWith("\n")) {
      gitIgnoreContent += "\n";
    }
    gitIgnoreContent += `# Ignore Nirvana extension folder\n${extensionFolderName}\n`;
    fs.writeFileSync(gitIgnorePath, gitIgnoreContent, "utf-8");
  }
}

async function createFilesUnderNirvanaFolder(
  workingDirectory: string,
  mainModuleFilePath: string,
): Promise<[boolean, string?]> {
  const err = await createHrmEntryFile(workingDirectory, mainModuleFilePath);
  if (err) {
    return [true, err];
  }
  await copyTypeDefFilesToTheFolder(workingDirectory);
  await configUserTsConfig(workingDirectory);
  await addNirvanaFolderToGitIgnore(workingDirectory);
  return [false, undefined];
}

class nestJsHrmBasedRepl implements REPL {
  private isReplStarted = false;
  private replServer: any = null;

  constructor(
    private workingDirectory: string,
    private nestJsMainModuleFilePath: string,
  ) {}

  private async launchRepl(app: any): Promise<void> {
    const repl = require("repl");

    this.replServer = repl.start({
      prompt: "NestJS (HMR) > ",
      ignoreUndefined: true,
    });

    // Add NestJS app context to REPL
    this.replServer.context.app = app;
    this.replServer.context.get = (token: any) => app.get(token);

    console.log("🚀 NestJS HMR REPL started successfully!");
  }

  private async setUpHrm(): Promise<string | undefined> {
    return new Promise(async (resolve, reject) => {
      try {
        // Dynamically import webpack to avoid bundling issues
        const webpack = await import("webpack");

        const webpackConfig = {
          entry: path.join(
            this.workingDirectory,
            `./${extensionFolderName}/${hrmEntryFileName}`,
          ),
          target: "node" as const,
          mode: "development" as const,
          output: {
            path: path.join(this.workingDirectory, `./${extensionFolderName}`),
            filename: "hmrEntryBundle.js",
          },
          externals: {
            // Don't bundle user's dependencies - use their node_modules
            "@nestjs/core": "commonjs @nestjs/core",
            "@nestjs/common": "commonjs @nestjs/common",
            "@nestjs/platform-express": "commonjs @nestjs/platform-express",
            "@nestjs/platform-fastify": "commonjs @nestjs/platform-fastify",
          },
          module: {
            rules: [
              {
                test: /\.ts$/,
                use: {
                  loader: "ts-loader",
                  options: {
                    configFile: path.join(
                      this.workingDirectory,
                      "tsconfig.json",
                    ),
                  },
                },
                exclude: /node_modules/,
              },
            ],
          },
          resolve: {
            extensions: [".ts", ".js"],
            // Resolve from user's node_modules first
            modules: [
              path.join(this.workingDirectory, "node_modules"),
              "node_modules",
            ],
          },
          plugins: [new webpack.default.HotModuleReplacementPlugin()],
        } as any;

        const compiler = webpack.default(webpackConfig);
        if (compiler == null) {
          reject("Failed to create webpack compiler");
          return;
        }
        appendNewLine(`setup compiler done.`);

        compiler.watch(
          {
            aggregateTimeout: 300,
            poll: undefined,
          },
          (err: any, stats: any) => {
            if (err) {
              appendNewLine(`"Webpack compilation error: ${err.message}`);
              console.error("Webpack compilation error:", err);
              reject(err.message);
              return;
            }

            if (stats?.hasErrors()) {
              appendNewLine(
                `"Webpack compilation error: ${JSON.stringify(stats.toJson().errors)}`,
              );
              console.error(
                "Webpack compilation errors:",
                stats.toJson().errors,
              );
              return;
            }

            appendNewLine("Webpack compilation successful");
            console.log("✅ Webpack compilation successful");

            // On first successful compilation, execute the bundle and start REPL
            if (!this.isReplStarted) {
              this.isReplStarted = true;

              try {
                // Execute the compiled bundle
                const bundlePath = path.join(
                  this.workingDirectory,
                  `./${extensionFolderName}/hmrEntryBundle.js`,
                );

                // Set the working directory context for the bundle
                const originalCwd = process.cwd();
                process.chdir(this.workingDirectory);

                try {
                  // Load and execute the bundle
                  delete require.cache[bundlePath];
                  require(bundlePath);
                } finally {
                  // Restore original working directory
                  process.chdir(originalCwd);
                }

                // Wait a bit for NestJS app to initialize
                setTimeout(() => {
                  if ((global as any).nestApplication) {
                    this.launchRepl((global as any).nestApplication);
                    resolve(undefined);
                  } else {
                    reject("NestJS application not found in global scope");
                  }
                }, 1000);
              } catch (executeError) {
                console.error("Error executing bundle:", executeError);
                reject(
                  executeError instanceof Error
                    ? executeError.message
                    : String(executeError),
                );
              }
            }
          },
        );
      } catch (importError) {
        reject(`Failed to import webpack: ${importError}`);
        return;
      }
    });
  }

  private async validateUserDependencies(): Promise<string | undefined> {
    const requiredDeps = ["@nestjs/core", "@nestjs/common"];
    const missingDeps: string[] = [];

    for (const dep of requiredDeps) {
      const depPath = path.join(this.workingDirectory, "node_modules", dep);
      if (!fs.existsSync(depPath)) {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      return `Missing required NestJS dependencies: ${missingDeps.join(", ")}. Please run: npm install ${missingDeps.join(" ")}`;
    }

    return undefined;
  }

  async init(): Promise<["OK" | "ERROR", string?]> {
    try {
      // Step 1: Validate user's dependencies
      const validationError = await this.validateUserDependencies();
      if (validationError) {
        return ["ERROR", validationError];
      }
      appendNewLine("validationError checked..");

      // Step 2: Create necessary files
      const [hasError, errorMsg] = await createFilesUnderNirvanaFolder(
        this.workingDirectory,
        this.nestJsMainModuleFilePath,
      );
      appendNewLine("files created..");
      if (hasError && errorMsg) {
        return ["ERROR", errorMsg];
      }

      // Step 3: Set up webpack HMR and launch REPL
      const setupError = await this.setUpHrm();
      if (setupError) {
        return ["ERROR", setupError];
      }
      appendNewLine("hmr setup done..");
      return ["OK", undefined];
    } catch (error) {
      return ["ERROR", error instanceof Error ? error.message : String(error)];
    }
  }

  async eval(code: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  status(): Promise<"ready" | "loading" | "reloading" | "disconnected"> {
    throw new Error("Method not implemented.");
  }

  close(): Promise<void> {
    if (this.replServer) {
      this.replServer.close();
    }
    return Promise.resolve();
  }
}

export async function start(context: ReplContext): Promise<REPL> {
  if (context.diInUse.nestJsMainModule == null) {
    throw new Error(
      "The nestJsMainModule inside REPLContext should be provided",
    );
  }

  // Set the extension path from the context
  if (context.extensionPath) {
    setExtensionPath(context.extensionPath);
  }

  return new nestJsHrmBasedRepl(
    context.workingDirectory,
    context.diInUse.nestJsMainModule,
  );
}
