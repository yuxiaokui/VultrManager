'use strict';

/**
 * 挑战：凯撒密码破解
 * 服务端用未知位移的凯撒密码加密 flag 明文，返回密文。
 * 解法：暴力尝试 25 个位移，找到恢复出 flag{...} 的那个。
 */
const express = require('express');

const FLAG = 'flag{caesar_shift_is_trivial}';
const SHIFT = 7; // 未知位移

function caesar(text, shift) {
  return text.split('').map((ch) => {
    if (/[a-z]/.test(ch)) return String.fromCharCode(((ch.charCodeAt(0) - 97 + shift + 26) % 26) + 97);
    if (/[A-Z]/.test(ch)) return String.fromCharCode(((ch.charCodeAt(0) - 65 + shift + 26) % 26) + 65);
    return ch;
  }).join('');
}

module.exports = {
  id: 'crypto-caesar',
  name: '凯撒密码破解',
  category: 'crypto',
  difficulty: 1,
  description:
    '服务端返回一段凯撒加密后的密文，位移未知（0-25）。明文就是 flag。\n' +
    '接口：GET /challenge',
  hints: [
    '密文是 flag{...} 加密而来，字母被整体平移了若干位',
    '写脚本暴力尝试 0-25 位移，找能恢复出 flag{ 开头的那个'
  ],
  flag: FLAG,
  createApp() {
    const app = express();

    app.get('/', (_req, res) => {
      res.json({
        name: '凯撒密码破解',
        challenge: 'GET /challenge 获取密文',
        note: '未知位移的凯撒密码'
      });
    });

    app.get('/challenge', (_req, res) => {
      res.json({ cipher: caesar(FLAG, SHIFT), format: 'plain 为 flag{...}' });
    });

    return app;
  }
};
