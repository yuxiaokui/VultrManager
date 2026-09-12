'use strict';

/**
 * 挑战：栈缓冲区溢出
 * 二进制会打印被覆盖后的 auth 值，通过观察输出可定位溢出偏移。
 */
const createBinaryApp = require('../lib/runner');

module.exports = {
  id: 'bin-overflow',
  name: '栈缓冲区溢出（变量覆盖）',
  category: 'binary',
  difficulty: 2,
  description:
    '目标二进制读取超长输入到 32 字节栈缓冲区，紧随其后的 int auth 可被溢出覆盖。' +
    '程序会把 auth 的当前值打印出来。\n' +
    '接口：POST /run {"input":"<base64>"}；GET /download 下载二进制。\n' +
    '目标：把 auth 覆盖为 0x41424344，程序将打印 flag。',
  hints: [
    '程序输出 "auth = 0x........"，用它观察溢出效果来定位偏移',
    '目标值 0x41424344 对应小端字节 "DCBA"',
    '输入 32 个填充字节后追加 "DCBA" 即可（注意 fgets 会追加 \\0）'
  ],
  createApp(ctx) {
    return createBinaryApp(ctx, {
      id: 'bin-overflow',
      bin: 'overflow',
      protections: '无栈保护(-fno-stack-protector)、无 PIE(-no-pie)、未开启 FORTIFY'
    });
  }
};
