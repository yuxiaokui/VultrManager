'use strict';

/**
 * 挑战：命令注入
 * 目标提供 ping 服务，但 host 参数被直接拼入 shell 命令。
 * 解法：在参数中注入 shell 语法，读取同目录下的 flag.txt。
 */
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'web-cmdi',
  name: '命令注入（RCE）',
  category: 'web',
  difficulty: 2,
  description:
    '目标系统提供了一个 "网络诊断" 接口，执行 ping 命令。host 参数被直接拼接到 shell 命令中，存在命令注入漏洞。\n' +
    '接口：GET /ping?host=xxx\n' +
    '目标：读取服务器上 flag.txt 的内容（flag 文件就在当前工作目录，先用 ;ls 查看）。',
  hints: [
    '试试 host=;ls —— 观察输出',
    '拿到文件列表后读取 flag.txt：host=;cat flag.txt'
  ],
  createApp(ctx) {
    const flagFile = path.join(ctx.challengeDir, 'flag.txt');
    fs.writeFileSync(flagFile, ctx.flag + '\n'); // 题目启动时写入 flag 文件

    const app = express();

    app.get('/', (_req, res) => {
      res.send('<h2>内网诊断工具</h2><form action="/ping"><input name="host" value="127.0.0.1"><button>Ping</button></form>');
    });

    app.get('/ping', (req, res) => {
      const host = req.query.host || '127.0.0.1';
      // 漏洞点：shell: true 且直接拼接（故意不加引号，使 ; 注入生效）
      const cmd = `echo === ping ${host} ===`;
      exec(cmd, { cwd: ctx.challengeDir, shell: '/bin/sh', timeout: 5000 }, (err, stdout, stderr) => {
        const out = stdout + stderr;
        if (err && !err.killed) {
          return res.status(500).json({ error: err.message, output: out });
        }
        res.type('text/plain').send(out || '(no output)');
      });
    });

    return app;
  }
};
