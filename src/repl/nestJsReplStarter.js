const { repl } = require('@nestjs/core');
const { resolve } = require('path');

async function bootstrap() {
  const mainFilePath = process.argv[2]; // Get main file path from CLI args
  try {
    console.log(`Loading NestJS module from: ${mainFilePath}`);
    
    // For TypeScript files, we need to handle both .ts and compiled paths
    let resolvedPath = resolve(mainFilePath);
    
    // Try to import the module
    let mainModule;
    try {
      // Try dynamic import first (works with both CJS and ESM)
      mainModule = await import(resolvedPath);
    } catch (importError) {
      console.log(`Dynamic import failed, trying require: ${importError.message}`);
      // Fallback to require for CommonJS
      mainModule = require(resolvedPath);
    }
    
    // The NestJS module can be exported in various ways
    const appModule = mainModule.default || 
                     mainModule.AppModule || 
                     mainModule[Object.keys(mainModule)[0]]; // Get first export if others fail
    
    if (!appModule) {
      console.error('No valid NestJS module found. Available exports:', Object.keys(mainModule));
      process.exit(1);
    }
    
    console.log('✅ Successfully loaded NestJS module');
    console.log('🚀 Starting NestJS REPL...');
    
    // Start the NestJS REPL
    await repl(appModule);
    
  } catch (error) {
    console.error('❌ Failed to load NestJS module:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

bootstrap();