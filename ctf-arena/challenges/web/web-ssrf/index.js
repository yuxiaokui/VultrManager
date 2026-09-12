'use strict';

/**
 * 挑战：SSRF（服务端请求伪造）
 * /fetch 可以请求任意 URL，服务端存在一个只允许内部访问的管理接口 /internal-admin。
 * 解法：利用 SSRF 让服务端自己去请求管理接口，带上内部认证头，拿到 flag。
 */
const express = require('express');
const http = require('http');
const https = require('https');

const INTERNAL_SECRET = 's3rv1ce_1nt3rn4l_k3y';

module.exports = {
  id: 'web-ssrf',
  name: 'SSRF 访问内网服务',
  category: 'web',
  difficulty: 3,
  description:
    '目标系统提供一个 "URL 预览" 接口 /fetch?url=xxx，可以访问任意 HTTP 服务。' +
    '同时存在一个仅限内网访问的管理接口 /internal-admin，外部无法直接调用。\n' +
    '目标：利用 SSRF 访问内部管理接口，获取 flag。',
  hints: [
    '先访问 /fetch?url=http://127.0.0.1:<本端口>/ 看看能否回环请求',
    '内部管理接口路径是 /internal-admin，它校验请求来源必须是本机回环且带内部认证头（由 /fetch 自动添加）',
    '尝试 /fetch?url=http://127.0.0.1:<本端口>/internal-admin'
  ],
  createApp(ctx) {
    const app = express();

    app.get('/', (_req, res) => {
      res.send('<h2>URL 预览服务</h2><form action="/fetch"><input name="url" value="http://example.com"><button>预览</button></form>');
    });

    // 仅内部可达的管理接口
    app.get('/internal-admin', (req, res) => {
      const fromLoopback = req.socket.remoteAddress === '127.0.0.1' || req.socket.remoteAddress === '::1' || req.socket.remoteAddress === '::ffff:127.0.0.1';
      if (!fromLoopback) {
        return res.status(403).json({ error: 'forbidden: 仅允许内部网络访问', yourIp: req.socket.remoteAddress });
      }
      if (req.headers['x-internal-auth'] !== INTERNAL_SECRET) {
        return res.status(403).json({ error: 'forbidden: 缺少内部认证头', hint: '内部请求会由 /fetch 自动附带 X-Internal-Auth 头' });
      }
      res.json({ ok: true, message: '内部管理接口访问成功', flag: ctx.flag });
    });

    // 漏洞点：SSRF
    app.get('/fetch', (req, res) => {
      const url = req.query.url || '';
      if (!/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: '仅支持 http/https', url });
      }
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return res.status(400).json({ error: 'URL 解析失败' });
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).json({ error: '不允许的协议' });
      }
      const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
      const headers = {};
      if (isLoopback) headers['X-Internal-Auth'] = INTERNAL_SECRET; // 内部请求自动带认证头

      const lib = parsed.protocol === 'https:' ? https : http;
      const req2 = lib.get(url, { headers }, (r2) => {
        let body = '';
        r2.setEncoding('utf8');
        r2.on('data', (d) => (body += d));
        r2.on('end', () => {
          res.json({ status: r2.statusCode, headers: r2.headers, body: body.slice(0, 2000) });
        });
      });
      req2.setTimeout(5000, () => req2.destroy(new Error('timeout')));
      req2.on('error', (e) => res.status(502).json({ error: e.message, url }));
    });

    return app;
  }
};
