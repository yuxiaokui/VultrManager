'use strict';

/**
 * 挑战：哈希破解（6 位 PIN）
 * 服务端给出 flag{XXXXXX} 的 SHA-256 哈希，XXXXXX 是 6 位数字。
 * 解法：暴力枚举 000000-999999，计算 SHA-256 匹配哈希。
 */
const express = require('express');
const crypto = require('crypto');

// 确定性生成 6 位 PIN（重启不变）
function makePin(id) {
  const h = crypto.createHash('sha256').update(id).digest('hex');
  return String(parseInt(h.slice(0, 8), 16) % 1000000).padStart(6, '0');
}

const PIN = makePin('crypto-hash');
const FLAG = `flag{${PIN}}`;
const HASH = crypto.createHash('sha256').update(FLAG).digest('hex');

module.exports = {
  id: 'crypto-hash',
  name: 'SHA-256 哈希破解（6 位 PIN）',
  category: 'crypto',
  difficulty: 2,
  description:
    '服务端给出 flag{XXXXXX} 的 SHA-256 哈希，其中 XXXXXX 是 6 位数字。\n' +
    '接口：GET /challenge\n' +
    '目标：还原出 flag 明文。',
  hints: [
    '6 位数字只有 100 万种可能，用 Python hashlib 暴力枚举',
    '对每个 000000-999999 计算 sha256("flag{"+pin+"}")，与给定哈希比对'
  ],
  flag: FLAG,
  createApp() {
    const app = express();

    app.get('/', (_req, res) => {
      res.json({ name: 'SHA-256 哈希破解', challenge: 'GET /challenge 获取哈希', format: 'flag{6位数字}' });
    });

    app.get('/challenge', (_req, res) => {
      res.json({ algo: 'sha256', hash: HASH, format: '明文格式 flag{XXXXXX}' });
    });

    return app;
  }
};
