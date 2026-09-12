'use strict';

/**
 * AI CTF 靶场平台主服务
 *  - 管理挑战注册、Flag 校验、通关状态
 *  - 提供对 AI 友好的 REST API（无验证码、无速率限制）
 */
const path = require('path');
const express = require('express');
const config = require('../config');
const { ChallengeRunner } = require('./challenges');
const StateStore = require('./state');

const state = new StateStore(config.stateFile);
const runner = new ChallengeRunner(config, state);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 简易请求日志
if (config.verbose) {
  app.use((req, _res, next) => {
    console.log(`[req] ${req.method} ${req.url}`);
    next();
  });
}

let publicChallenges = [];

// ---------- 平台 API ----------

app.get('/', (_req, res) => {
  res.json({
    name: 'AI CTF Arena',
    version: '1.0.0',
    api: {
      challenges: 'GET /api/challenges',
      challenge: 'GET /api/challenges/:id',
      submit: 'POST /api/submit  {challenge_id, flag}',
      status: 'GET /api/status'
    }
  });
});

/** 挑战列表（不含 flag） */
app.get('/api/challenges', (_req, res) => {
  res.json(publicChallenges);
});

/** 单个挑战详情（不含 flag，含提示与通关状态） */
app.get('/api/challenges/:id', (req, res) => {
  const c = publicChallenges.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'challenge not found' });
  res.json(c);
});

/** 提交 flag */
app.post('/api/submit', (req, res) => {
  const { challenge_id, flag } = req.body || {};
  if (!challenge_id || !flag) {
    return res.status(400).json({ ok: false, reason: 'missing challenge_id or flag' });
  }
  const before = state.status(challenge_id);
  const result = runner.verify(challenge_id, String(flag));
  if (!result.ok && result.reason) {
    return res.status(404).json({ ok: false, reason: result.reason });
  }
  res.json({ ok: result.ok, solved: result.solved });
  console.log(`[submit] ${challenge_id} -> ${result.ok ? 'CORRECT ✓' : 'wrong'} (${before.attempts} attempts)`);
});

/** 全局通关状态 */
app.get('/api/status', (_req, res) => {
  const all = state.allStatus();
  const list = publicChallenges.map((c) => ({ id: c.id, ...all[c.id] }));
  res.json({ total: list.length, solved: list.filter((x) => x.solved).length, challenges: list });
});

async function main() {
  console.log('[platform] 启动挑战...');
  publicChallenges = await runner.startAll();
  console.log(`[platform] 共加载 ${publicChallenges.length} 道挑战`);

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[platform] AI CTF Arena 运行于 http://127.0.0.1:${config.port}`);
  });
}

process.on('SIGINT', async () => {
  await runner.stopAll();
  process.exit(0);
});

if (require.main === module) {
  main().catch((e) => {
    console.error('[platform] 启动失败:', e);
    process.exit(1);
  });
}

module.exports = { app, runner, state };
