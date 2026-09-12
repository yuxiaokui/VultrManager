'use strict';

/**
 * 挑战：单字节 XOR 破解
 * 服务端用单个未知字节对 flag 明文逐字节异或，返回十六进制密文。
 * 解法：暴力尝试 256 个密钥字节，找出恢复出可读 flag 的那个。
 */
const express = require('express');

const FLAG = 'flag{xor_single_byte_is_weak}';
const KEY = 0x5a;

function encrypt(text, key) {
  return Buffer.from(text, 'utf8').map((b) => b ^ key).toString('hex');
}

module.exports = {
  id: 'crypto-xor',
  name: '单字节 XOR 破解',
  category: 'crypto',
  difficulty: 1,
  description:
    '服务端用单个未知字节（0-255）对 flag 明文做逐字节异或加密，返回十六进制密文。\n' +
    '接口：GET /challenge',
  hints: [
    '单字节异或密钥只有 256 种可能',
    '写脚本尝试 0-255 每个密钥，解密后找可读的 ASCII 文本'
  ],
  flag: FLAG,
  createApp() {
    const app = express();

    app.get('/', (_req, res) => {
      res.json({
        name: '单字节 XOR 破解',
        challenge: 'GET /challenge 获取密文',
        note: '未知单字节密钥的 XOR 加密'
      });
    });

    app.get('/challenge', (_req, res) => {
      res.json({ cipher_hex: encrypt(FLAG, KEY), encoding: 'hex', note: '明文即 flag' });
    });

    return app;
  }
};
