/*
 * 栈缓冲区溢出（变量覆盖）
 * 编译参数：gcc -o bin/overflow overflow.c -fno-stack-protector -no-pie
 *
 * 程序读取超长输入到 32 字节缓冲区，紧随其后的 int auth 可被覆盖。
 * 程序会打印 auth 当前值，方便定位溢出偏移。
 * 目标：把 auth 覆盖为 0x41424344（小端字节为 "DCBA"），即可打印 flag。
 */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

int main(void) {
    char buf[32];
    int auth = 0;

    setbuf(stdout, NULL);
    printf("input: ");

    /* 漏洞点：读取长度不受控，可溢出覆盖 auth */
    fgets(buf, 200, stdin);

    printf("auth = 0x%08x\n", (unsigned)auth);
    if (auth == 0x41424344) {
        FILE *f = fopen("flag.txt", "r");
        char line[256];
        if (f) {
            fgets(line, sizeof(line), f);
            printf("flag: %s", line);
            fclose(f);
        } else {
            printf("no flag.txt\n");
        }
    } else {
        printf("denied\n");
    }
    return 0;
}
