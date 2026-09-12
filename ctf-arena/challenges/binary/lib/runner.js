'use strict';

/**
 * 二进制挑战通用运行器：
 * 每个二进制挑战暴露 /info、/download、/run，方便 AI 自动化交互。
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');

/**
 * @param {object} ctx 平台上下文 { port, flag, challengeDir }
 * @param {object} opts { bin: 二进制相对文件名, protections: 描述 }
 */
function createBinaryApp(ctx, opts) {
  // 二进制统一编译到 challenges/binary/bin/ 目录
  const binPath = path.join(ctx.challengeDir, '..', 'bin', opts.bin);
  const flagFile = path.join(ctx.challengeDir, 'flag.txt');
  fs.writeFileSync(flagFile, ctx.flag + '\n'); // 启动时写入 flag 文件

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({
      challenge: opts.id,
      binary: opts.bin,
      endpoints: {
        info: 'GET /info 二进制信息',
        download: 'GET /download 下载二进制（用于逆向分析）',
        run: 'POST /run {"input":"<base64>"} 以 stdin 运行二进制并返回输出'
      }
    });
  });

  app.get('/info', (_req, res) => {
    res.json({
      binary: opts.bin,
      arch: process.arch,
      protections: opts.protections || '见 /download 自行用 checksec/objdump 分析',
      note: '程序在当前目录读取 flag.txt'
    });
  });

  app.get('/download', (_req, res) => {
    if (!fs.existsSync(binPath)) return res.status(404).json({ error: '二进制未编译，请先运行 npm run setup' });
    res.download(binPath);
  });

  app.post('/run', (req, res) => {
    if (!fs.existsSync(binPath)) return res.status(404).json({ error: '二进制未编译，请先运行 npm run setup' });
    const { input, args } = req.body || {};
    let buf = Buffer.alloc(0);
    if (typeof input === 'string') {
      buf = Buffer.from(input, 'base64');
    } else if (Buffer.isBuffer(input)) {
      buf = input;
    } else if (input == null) {
      buf = Buffer.alloc(0);
    } else {
      return res.status(400).json({ error: 'input 需为 base64 字符串' });
    }
    const argv = Array.isArray(args) ? args.map(String) : [];

    const child = spawn(binPath, argv, { cwd: ctx.challengeDir, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 4000);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (e) => {
      clearTimeout(timer);
      res.json({ error: e.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      res.json({ exitCode: code, timedOut, stdout, stderr });
    });
    child.stdin.end(buf);
  });

  return app;
}

module.exports = createBinaryApp;
