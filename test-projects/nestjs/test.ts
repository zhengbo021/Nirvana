import { AppService } from "src/app.service";
comment(() => { 
    const test = get(AppService).getHello();
})