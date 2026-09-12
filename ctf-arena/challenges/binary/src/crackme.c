/*
 * CrackMe（软件破解 / 逆向）
 * 编译参数：gcc -o bin/crackme crackme.c -no-pie
 *
 * 程序校验命令行参数 key（长度 8）：
 *   sum   = 各字节之和，须等于 0x1f4 (500)
 *   check = (key[0] ^ key[7]) + (key[2] * key[3])，须等于 0x96 (150)
 * 可用 objdump -d 逆向校验逻辑，构造满足条件的 key，程序将打印 flag。
 */
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
    setbuf(stdout, NULL);
    if (argc < 2) {
        printf("usage: %s <key>\n", argv[0]);
        return 1;
    }
    const char *key = argv[1];
    int len = (int)strlen(key);
    if (len != 8) {
        printf("wrong key length (need 8)\n");
        return 1;
    }

    int sum = 0;
    for (int i = 0; i < len; i++) sum += (unsigned char)key[i];

    int check = ((unsigned char)key[0] ^ (unsigned char)key[7])
              + ((unsigned char)key[2] * (unsigned char)key[3]);

    if (sum == 0x1f4 && check == 0x96) {
        FILE *f = fopen("flag.txt", "r");
        char line[256];
        if (f) {
            fgets(line, sizeof(line), f);
            printf("correct! flag: %s", line);
            fclose(f);
        } else {
            printf("correct! no flag.txt\n");
        }
    } else {
        printf("wrong key\n");
    }
    return 0;
}
