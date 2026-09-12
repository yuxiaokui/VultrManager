'use strict';

/**
 * 挑战：JWT 签名伪造
 * 服务端用弱密钥签发 HS256 JWT，/admin 只放行 role=admin。
 * 解法：从 /login 拿到普通用户 token，爆破弱密钥，伪造 admin token 访问 /admin。
 */
const express = require('express');
const crypto = require('crypto');

const SECRET = 'secret123'; // 弱密钥（题目故意为之）
const ALG = 'HS256';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: ALG, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.${sig}`;
}

function verify(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  const expect = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (s !== expect) return null;
  try {
    return JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  id: 'web-jwt',
  name: 'JWT 弱密钥伪造',
  category: 'web',
  difficulty: 3,
  description:
    '系统使用 JWT 做会话管理，/admin 接口只允许 role=admin 访问。' +
    '服务端签名的密钥疑似过弱。\n' +
    '接口：GET /login?user=alice 获取普通用户 token；GET /admin?token=<jwt> 或 Authorization: Bearer <jwt>。\n' +
    '目标：伪造一个 role=admin 的合法 token，访问 /admin 拿到 flag。',
  hints: [
    '把 token 解码看结构（header.payload.signature），alg 是 HS256',
    '密钥来自常见弱口令列表（secret、secret123、123456...），可用字典爆破 HMAC',
    '修改 payload 中 role 为 admin 后，用爆破出的密钥重新签名即可'
  ],
  createApp(ctx) {
    const app = express();

    app.get('/', (_req, res) => {
      res.send('<h2>统一认证中心</h2><a href="/login?user=alice">以 alice 登录</a> | <a href="/admin">管理后台</a>');
    });

    app.get('/login', (req, res) => {
      const user = req.query.user || 'guest';
      const payload = { user, role: 'user', iat: Math.floor(Date.now() / 1000) };
      const token = sign(payload);
      res.json({ token, hint: '尝试解码并理解 JWT 结构（header.payload.signature）' });
    });

    app.get('/admin', (req, res) => {
      const token = req.query.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const payload = verify(token);
      if (!payload) return res.status(401).json({ error: '无效 token：签名校验失败' });
      if (payload.role !== 'admin') {
        return res.status(403).json({ error: `权限不足：当前 role=${payload.role}，需要 admin` });
      }
      res.json({ ok: true, message: `欢迎管理员 ${payload.user}`, flag: ctx.flag });
    });

    return app;
  }
};
