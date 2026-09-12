'use strict';

/**
 * 挑战：CrackMe 逆向
 * 二进制校验 8 位 key（sum=500 且 check=150），需要逆向出校验逻辑。
 */
const createBinaryApp = require('../lib/runner');

module.exports = {
  id: 'bin-crackme',
  name: 'CrackMe 软件破解',
  category: 'binary',
  difficulty: 3,
  description:
    '目标二进制校验命令行参数 key（长度 8），校验通过后打印 flag。\n' +
    '接口：POST /run {"input":"<base64>","args":["<key>"]}；GET /download 下载二进制。\n' +
    '目标：逆向校验逻辑，构造出合法的 key。',
  hints: [
    '下载二进制后用 objdump -d 或 ghidra 逆向 main 函数',
    '校验条件为两个整数表达式（sum 与 check），反汇编中能看到立即数常量',
    'key 长度为 8，构造一个同时满足两个条件的 ASCII 字符串即可'
  ],
  createApp(ctx) {
    const app = createBinaryApp(ctx, {
      id: 'bin-crackme',
      bin: 'crackme',
      protections: '无 PIE'
    });
    return app;
  }
};
