// 这是一个演示文件，用于测试 Nirvana 的自动补全功能
// 当您输入 app.get( 时应该会看到 AppService 的自动补全
// 当您输入 app.get(AppService). 时应该会看到方法的自动补全
import { AppService } from './app.service';

// 完整的示例 (这些应该不会报 TypeScript 错误)
async function replExample() {
    // 获取服务实例
    // const appService = app.get(AppService);
    // 调用方法
    // const message = appService.getHello();
    // console.log(message);
    // 或者直接调用
    // const directResult = app.get(AppService).getHello();
    // console.log(directResult);

    //run current line: cmd+enter.
    //or run selected code: first selected and enter cmd+enter
    //or run the code inside the repl block: write code inside the block and enter the ) of the repl
    repl(() => {
        // 获取服务实例
        const appService = app.get(AppService);
        // 调用方法
        const message = appService.getHello();
        console.log(message);
        // 或者直接调用
        const directResult = app.get(AppService).getHello();
        console.log(directResult);
    })
}