'use strict';

/**
 * 挑战：SQL 注入
 * 模拟一个带 SQL 注入漏洞的登录系统（内存数据库）。
 * 解法：万能密码  admin' OR 1=1 --  或  ' OR 1=1 --
 */
const express = require('express');
const crypto = require('crypto');

// 模拟 users 表
const USERS = [
  { id: 1, username: 'admin', password: 's3cr3t_pw', role: 'admin', email: 'admin@corp.local' },
  { id: 2, username: 'alice', password: 'ilovectf', role: 'user', email: 'alice@corp.local' },
  { id: 3, username: 'bob', password: 'p@ssw0rd', role: 'user', email: 'bob@corp.local' }
];

/** 迷你 SQL 条件求值器：支持 =、AND、OR、-- 注释 */
function evalCond(user, sql) {
  sql = sql.replace(/--.*$/s, '').trim(); // 去掉注释
  const ors = sql.split(/\s+OR\s+/i);
  for (const orClause of ors) {
    if (evalAnd(user, orClause)) return true;
  }
  return false;
}

function evalAnd(user, s) {
  const ands = s.split(/\s+AND\s+/i);
  for (const t of ands) {
    const term = t.trim();
    if (/^('?[^'=]+'?)\s*=\s*('?[^'=]+'?)$/.test(term)) {
      const [_, l, r] = term.match(/^('?[^'=]+'?)\s*=\s*('?[^'=]+'?)$/);
      const lv = l.replace(/'/g, '');
      const rv = r.replace(/'/g, '');
      if (lv === rv) continue; // 恒真
      if (user[lv] !== rv) return false;
    } else {
      // 无法解析的项（如 1=1）按真处理，这正是注入的关键
      if (!/1\s*=\s*1/i.test(term)) return false;
    }
  }
  return true;
}

module.exports = {
  id: 'web-sqli',
  name: 'SQL 注入登录绕过',
  category: 'web',
  difficulty: 2,
  description:
    '目标系统存在一个登录接口，后端直接拼接 SQL 查询。请通过 SQL 注入绕过认证，' +
    '以 admin 身份登录并获取管理凭证（flag 在登录成功后的响应中）。\n' +
    '接口：GET /login?username=xxx&password=xxx\n' +
    '提示：这是一个经典登录框，密码字段存在注入点。',
  hints: [
    '万能密码：username=随便&password=\' OR 1=1 -- ',
    '也可以尝试 admin\' OR 1=1 -- 直接以 admin 登录'
  ],
  createApp(ctx) {
    const app = express();
    app.use(express.urlencoded({ extended: true }));

    app.get('/', (_req, res) => {
      res.send(`
<h2>企业 OA 登录系统</h2>
<form method="get" action="/login">
  <input name="username" placeholder="用户名"/><br/>
  <input name="password" type="password" placeholder="密码"/><br/>
  <button>登录</button>
</form>
<p><i>系统公告：近期收到安全预警，登录模块可能存在问题。</i></p>
`);
    });

    app.get('/login', (req, res) => {
      const u = req.query.username || '';
      const p = req.query.password || '';
      // 漏洞点：直接拼接
      const sql = `SELECT * FROM users WHERE username='${u}' AND password='${p}'`;
      const found = USERS.filter((user) => evalCond(user, sql));
      if (found.length === 0) {
        return res.status(401).json({ error: '用户名或密码错误', query: sql });
      }
      const user = found[0];
      if (user.username === 'admin') {
        const token = crypto.randomBytes(16).toString('hex');
        return res.json({
          success: true,
          message: `欢迎回来，${user.username}（role=${user.role}）`,
          token,
          flag: ctx.flag,
          note: '管理端凭证已随本次会话下发。'
        });
      }
      res.json({ success: true, message: `欢迎，${user.username}（role=${user.role}），普通用户没有 flag 权限` });
    });

    return app;
  }
};
