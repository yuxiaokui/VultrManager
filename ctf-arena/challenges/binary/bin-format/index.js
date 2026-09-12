'use strict';

/**
 * 挑战：格式化字符串（栈泄露）
 * 程序把 flag 读入栈缓冲区后直接用用户输入作为 printf 格式串。
 */
const createBinaryApp = require('../lib/runner');

module.exports = {
  id: 'bin-format',
  name: '格式化字符串栈泄露',
  category: 'binary',
  difficulty: 3,
  description:
    '目标二进制把 flag 读取到栈上缓冲区 secret，然后直接使用用户输入作为 printf 的格式字符串。\n' +
    '接口：POST /run {"input":"<base64>"}；GET /download 下载二进制。\n' +
    '目标：用 %p 链泄露栈内容，从泄露数据中还原 flag。',
  hints: [
    '输入格式串 "%p.%p.%p..."（越多越好，如 40 个 %p），程序会打印一串指针/栈值',
    '把每个 %p 输出的十六进制转成字节，其中会出现 flag 的 ASCII 文本',
    '写 Python 脚本：解析输出 -> 十六进制转字节 -> 搜索 "flag{"'
  ],
  createApp(ctx) {
    return createBinaryApp(ctx, {
      id: 'bin-format',
      bin: 'format',
      protections: '无栈保护、无 PIE'
    });
  }
};
