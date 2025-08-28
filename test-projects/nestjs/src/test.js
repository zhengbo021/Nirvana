var x = "sdf23432";
var y = "asdfasf";
console.log(`${x} ${y}`)


    (function clearModuleCache(moduleName) {
        try {
            var resolvedPath = require.resolve(moduleName);
            var module = require.cache[resolvedPath];
            if (module && module.children) {
                module.children.forEach(child => {
                    if (child.filename && child.filename.includes(process.cwd()) && !child.filename.includes('node_modules')) {
                        delete require.cache[child.filename];
                    }
                });
            }
            delete require.cache[resolvedPath];
        }
        catch (e) { }
    })('./src/repl-demo');
var __currentFile = require('./src/repl-demo');
Object.keys(__currentFile).forEach(key => {
    if (key !== 'default')
        global[key] = __currentFile[key];
});
(function clearModuleCache(moduleName) {
    try {
        var resolvedPath = require.resolve(moduleName);
        var module = require.cache[resolvedPath];
        if (module && module.children) { }
    }
    finally { }
}); // 递归清理依赖的本地模块缓存             module.children.forEach(child => {                 if (child.filename && child.filename.includes(process.cwd()) &&                      !child.filename.includes('node_modules')) {                     delete require.cache[child.filename];                 }             });         }         delete require.cache[resolvedPath];     } catch (e) {         // 忽略解析失败的模块     } })('./src/util'); const { fromUtil } = require('./src/util');
console.log('Nirvana REPL Eval Done:278ae102-8116-4724-84e9-7c7fc99017bb');