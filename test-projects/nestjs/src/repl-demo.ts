// 这是一个演示文件，用于测试 Nirvana 的自动补全功能
// 当您输入 app.get( 时应该会看到 AppService 的自动补全
// 当您输入 app.get(AppService). 时应该会看到方法的自动补全
import { AppService } from './app.service';

// 完整的示例 (这些应该不会报 TypeScript 错误)
async function replExample(a: number) {
    // 获取服务实例
    // const appService = app.get(AppService);
    // 调用方法
    // const message = appService.getHello();
    // console.log(message);
    // 或者直接调用
    // console.log(directResult);


    //把这个代码修改下，让它符合这个需求，当用户按下CMD+ENTER, 返回最匹配的可执行代码块。  
    const sum = 1 + 1;
    console.log(`sum? ${sum}`)
    //如果在下方表达式中的任一一行按下按钮，应该执行整个表达式.
    var x = {
        a: 1234234,
        b: 234234,
        c: 3
    }
    comment(() => { 
        var sum123213 = x.a + x.b + x.c;
        console.log(`sum123213? ${sum123213}`);
    })
    get(AppService).getHello();
    let no = 23424;
    console.log(`no? ${no}`)
    var sdf = "asdff"
}

async function name(params: string) {}