'use strict';

/**
 * 挑战：单表替换密码破解
 * 服务端用未知的字母置换对一段英文明文加密（密钥确定不变），返回密文。
 * 明文包含著名英文 pangram（含全部 26 个字母），其中内嵌 flag。
 * 解法：频率分析 / 结构对齐，恢复置换映射后解出 flag。
 */
const express = require('express');
const crypto = require('crypto');

const FLAG = 'flag{substitution_analysis_done}';
const PLAIN =
  'the quick brown fox jumps over the lazy dog and the hidden flag is ' + FLAG;

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

// 确定性字母置换表（由题目 id 派生，重启不变）
function makeSubstitution(seed) {
  const h = crypto.createHash('sha256').update(seed).digest();
  let x = h.readUInt32BE(0);
  const letters = ALPHA.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const j = x % (i + 1);
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const map = {};
  ALPHA.split('').forEach((ch, i) => (map[ch] = letters[i]));
  return map;
}

const SUB = makeSubstitution('crypto-subst');

function encrypt(text) {
  return text.split('').map((ch) => (SUB[ch] ? SUB[ch] : ch)).join('');
}

module.exports = {
  id: 'crypto-subst',
  name: '单表替换密码破解',
  category: 'crypto',
  difficulty: 4,
  description:
    '服务端用未知的字母置换（单表替换密码）加密一段英文明文，返回密文。' +
    '密钥固定不变，明文内嵌 flag。\n' +
    '接口：GET /challenge',
  hints: [
    '这是单表替换密码：同一个明文字母永远映射到同一个密文字母',
    '明文中包含一句经典英文 pangram：the quick brown fox jumps over the lazy dog（包含全部 26 个字母）',
    '先用 "the" 等高频词对齐部分映射，再解出 flag 部分；或用 Python 脚本做频率分析'
  ],
  flag: FLAG,
  createApp() {
    const app = express();

    app.get('/', (_req, res) => {
      res.json({ name: '单表替换密码破解', challenge: 'GET /challenge 获取密文' });
    });

    app.get('/challenge', (_req, res) => {
      res.json({ cipher: encrypt(PLAIN), hint: '明文中含一句著名英文 pangram，flag 内嵌其中' });
    });

    return app;
  }
};
