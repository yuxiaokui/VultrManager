'use strict';

/**
 * 挑战：内网渗透（横向移动仿真）
 *
 * 模拟一个 3 台主机的内网：
 *   主机1 (dmz-web-01)  边缘 Web 服务，弱口令登录 -> 拿到 tokenA
 *   主机2 (app-01)      应用服务器，需 tokenA，存在命令注入 -> 读取 creds.txt 拿到 tokenB
 *   主机3 (db-01)       数据库主机，需 tokenB -> 返回 flag
 *
 * 三台主机是真实监听端口的服务（入口端口+0/+1/+2），需要像真实内网一样先扫描发现。
 * 全平台与靶机同机时请将攻击视角理解为"已获得内网一跳后的攻击机"。
 */
const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../../../config');

function token(seed) {
  return crypto.createHash('sha256').update('net-pivot:' + seed).digest('hex').slice(0, 32);
}
const TOKEN_A = token('host_a');
const TOKEN_B = token('host_b');
const WEAK_PASS = '123456';

module.exports = {
  id: 'net-pivot',
  name: '内网渗透 · 多主机横向移动',
  category: 'network',
  difficulty: 4,
  description:
    '已获得内网边缘一台主机的攻击入口。内网中还有 2 台主机，请横向移动最终拿到数据库主机上的 flag。\n' +
    '入口主机：GET <entry>/info 查看主机信息；GET <entry>/login?user=admin&pass=<密码> 登录（弱口令）。\n' +
    '流程：边缘主机 -> 应用服务器（命令注入）-> 数据库主机（flag）。\n' +
    '内网主机都监听在本机附近端口（入口端口+0/+1/+2），先写脚本扫描确认存活主机。',
  hints: [
    '先扫描 127.0.0.1 上入口端口附近的一段端口（入口+0 到 +5），找出存活主机',
    '主机1 登录是弱口令（常见 6 位数字）',
    '主机2 需要主机1 返回的 token（请求头 X-Auth-Token），存在命令注入接口 /cmd?c=xxx，读取 creds.txt',
    '主机3 需要主机2 中读取到的 tokenB'
  ],
  createApp(ctx) {
    const base = config.networkBasePort;
    const host2Dir = ctx.challengeDir;

    // ---------- 主机1：边缘 Web 服务 ----------
    const host1 = express();
    host1.use(express.urlencoded({ extended: true }));

    host1.get('/', (_req, res) => {
      res.send(`<h2>dmz-web-01 边缘门户</h2>
<form action="/login"><input name="user" value="admin"><input name="pass"><button>登录</button></form>
<!-- 系统上线通知：后台密码使用弱口令，运维正在整改中 -->
`);
    });

    host1.get('/info', (_req, res) => {
      res.json({ hostname: 'dmz-web-01', ip: '10.0.0.2', services: ['http(80)'], note: '尝试登录后台' });
    });

    host1.get('/login', (req, res) => {
      const u = req.query.user || '';
      const p = req.query.pass || '';
      if (u === 'admin' && p === WEAK_PASS) {
        res.json({
          success: true,
          message: '登录成功，欢迎管理员',
          token: TOKEN_A,
          note: '内网存在其他主机，请扫描发现（入口端口附近的存活端口）',
          hint: '下一台主机需要请求头 X-Auth-Token 携带本 token'
        });
      } else {
        res.status(401).json({ error: '认证失败' });
      }
    });

    // ---------- 主机2：应用服务器（命令注入） ----------
    const host2 = express();
    host2.use(express.urlencoded({ extended: true }));

    // 模拟数据库凭证文件
    const credsFile = path.join(host2Dir, 'creds.txt');
    fs.writeFileSync(credsFile, `tokenB=${TOKEN_B}\ndb_host=db-01\ndb_port=${base + 2}\nnote=数据库主机需要 X-Auth-Token 携带 tokenB\n`);

    function requireTokenA(req, res, next) {
      if (req.headers['x-auth-token'] !== TOKEN_A) {
        return res.status(401).json({ error: 'forbidden: 需要 X-Auth-Token', hint: '该值从主机1 登录响应中获得' });
      }
      next();
    }

    host2.get('/', requireTokenA, (_req, res) => {
      res.json({
        hostname: 'app-01',
        ip: '10.0.0.3',
        services: ['http(8080)', 'debug(cmd)'],
        hint: '存在命令执行接口 /cmd?c=<command>'
      });
    });

    host2.get('/cmd', requireTokenA, (req, res) => {
      const c = req.query.c || '';
      if (!c) return res.json({ error: '用法: /cmd?c=<command>' });
      exec(c, { cwd: host2Dir, shell: '/bin/sh', timeout: 4000 }, (err, stdout, stderr) => {
        res.type('text/plain').send(stdout + stderr + (err && !err.killed ? '\n[err] ' + err.message : ''));
      });
    });

    // ---------- 主机3：数据库主机（flag） ----------
    const host3 = express();
    host3.use(express.urlencoded({ extended: true }));

    host3.get('/', (req, res) => {
      if (req.headers['x-auth-token'] !== TOKEN_B) {
        return res.status(401).json({ error: 'forbidden: 需要 X-Auth-Token', hint: '从主机2 的命令执行结果中获取' });
      }
      res.json({
        hostname: 'db-01',
        ip: '10.0.0.4',
        message: '数据库主机访问成功',
        flag: ctx.flag
      });
    });

    // 三个主机都监听在 networkBasePort+0/+1/+2，由平台统一托管
    const servers = [host1, host2, host3].map((h, i) =>
      h.listen(base + i, '0.0.0.0')
    );
    return {
      app: null, // 不额外监听，入口 URL 见下
      extraServers: servers,
      url: `http://127.0.0.1:${base}`
    };
  }
};
