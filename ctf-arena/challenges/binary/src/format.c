/*
 * 格式化字符串漏洞（栈泄露）
 * 编译参数：gcc -o bin/format format.c -fno-stack-protector -no-pie
 *
 * 程序把 flag 读入栈上缓冲区 secret，随后直接用用户输入作为 printf 的格式串。
 * 用 "%p.%p.%p..." 链可以泄露栈内容，flag 的 ASCII 字节会出现在其中。
 * 目标：从泄露的栈数据中还原 flag。
 */
#include <stdio.h>
#include <string.h>

int main(void) {
    char secret[128];
    char input[256];

    setbuf(stdout, NULL);

    FILE *f = fopen("flag.txt", "r");
    if (!f) {
        printf("no flag.txt\n");
        return 1;
    }
    fgets(secret, sizeof(secret), f);
    fclose(f);

    printf("hint: 输入格式串，例如 %%p.%%p.%%p\n");
    printf("your input: ");
    fgets(input, sizeof(input), stdin);

    /* 漏洞点：直接使用用户输入作为格式串 */
    printf(input);
    printf("\n");
    return 0;
}
