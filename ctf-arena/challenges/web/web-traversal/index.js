'use strict';

/**
 * 挑战：路径穿越（目录遍历）
 * /download?file=xxx 读取 downloads/ 目录下的文件，未做路径校验。
 * flag 存放在 secret/ 目录中，可通过 ../secret/flag.txt 读取。
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'web-traversal',
  name: '路径穿越任意文件读取',
  category: 'web',
  difficulty: 1,
  description:
    '目标系统提供文件下载接口 /download?file=xxx，可下载 downloads/ 目录中的文件。' +
    '服务端未对文件名做任何过滤。\n' +
    '目标：读取 secret/flag.txt。',
  hints: [
    '先 GET /download?file=readme.txt 观察正常行为',
    '目录结构：downloads/ 与 secret/ 在同一级，用 ../ 向上穿越',
    'GET /download?file=../secret/flag.txt'
  ],
  createApp(ctx) {
    const dlDir = path.join(ctx.challengeDir, 'downloads');
    const secretDir = path.join(ctx.challengeDir, 'secret');
    fs.mkdirSync(dlDir, { recursive: true });
    fs.mkdirSync(secretDir, { recursive: true });
    fs.writeFileSync(path.join(secretDir, 'flag.txt'), ctx.flag + '\n');
    fs.writeFileSync(path.join(dlDir, 'readme.txt'), '这是公开下载目录。敏感文件在上级目录的 secret/ 中。\n');

    const app = express();

    app.get('/', (_req, res) => {
      const files = fs.readdirSync(dlDir);
      res.json({ downloads: files, note: '下载接口：/download?file=<文件名>' });
    });

    // 漏洞点：路径拼接未校验
    app.get('/download', (req, res) => {
      const name = req.query.file || '';
      if (!name) return res.status(400).json({ error: '缺少 file 参数' });
      // 故意不拦截 ../ 穿越，仅拒绝绝对路径
      if (name.startsWith('/')) return res.status(400).json({ error: '非法路径' });
      const fp = path.join(dlDir, name);
      if (!fs.existsSync(fp)) return res.status(404).json({ error: '文件不存在', path: fp });
      res.type('text/plain').send(fs.readFileSync(fp, 'utf8'));
    });

    return app;
  }
};
