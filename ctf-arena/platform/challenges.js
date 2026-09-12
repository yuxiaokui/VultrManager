'use strict';

/**
 * 挑战加载器与运行器
 *
 * 挑战模块约定： challenges/<category>/<name>/index.js
 *   module.exports = {
 *     id: 'web-sqli',                 // 唯一 id
 *     name: 'SQL 注入',
 *     category: 'web',                // web | crypto | binary | network
 *     difficulty: 2,                  // 1-5
 *     description: '...',             // 给 AI / 选手的题目说明
 *     hints: ['...'],                 // 提示（按需购买或直接展示）
 *     flag: 'flag{...}' 或 undefined, // 缺省时自动生成
 *     portOffset: 0,                  // 相对基础端口的偏移
 *     createApp: async (ctx) => ExpressApp  // ctx: { port, flag, dataDir, challengeDir }
 *   }
 *
 * 平台会给每个挑战分配独立端口，启动一个 Express 服务，形成进程级隔离。
 * 若配置了 DOCKER=1，可扩展为每个挑战一个容器（见 README）。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

/** 确定性生成 flag，重启后保持不变，保证已通关状态有效 */
function genFlag(id) {
  return 'flag{' + crypto.createHash('sha256').update('ai-ctf-arena:' + id).digest('hex').slice(0, 16) + '}';
}

/** 递归发现所有挑战模块 */
function discover() {
  const modules = [];
  const base = path.join(__dirname, '..', 'challenges');
  for (const category of fs.readdirSync(base)) {
    const catDir = path.join(base, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const name of fs.readdirSync(catDir)) {
      const idx = path.join(catDir, name, 'index.js');
      if (fs.existsSync(idx)) {
        const mod = require(idx);
        if (!mod.id) throw new Error(`挑战缺少 id: ${idx}`);
        modules.push({ mod, category, name, dir: path.join(catDir, name) });
      }
    }
  }
  // 按 category 排序，稳定端口分配
  const order = { web: 0, crypto: 1, binary: 2, network: 3 };
  modules.sort((a, b) => (order[a.category] - order[b.category]) || a.mod.id.localeCompare(b.mod.id));
  return modules;
}

class ChallengeRunner {
  constructor(config, stateStore) {
    this.config = config;
    this.state = stateStore;
    this.challenges = [];
    this.servers = [];
  }

  /** 启动所有挑战，返回元数据数组（不含 flag） */
  async startAll() {
    const modules = discover();
    let offset = 0;
    for (const { mod, category, name, dir } of modules) {
      const port = this.config.challengeBasePort + offset;
      offset += 1;
      const flag = mod.flag || genFlag(mod.id);
      const ctx = {
        port,
        flag,
        dataDir: this.config.dataDir,
        challengeDir: dir,
        basePort: this.config.challengeBasePort
      };
      const created = await this._createApp(mod, ctx);
      // 兼容：createApp 可返回 Express app，或 { app, extraServers, url }
      let app = created;
      let url;
      const extraServers = [];
      if (created && typeof created.listen !== 'function') {
        app = created.app;
        url = created.url;
        if (Array.isArray(created.extraServers)) extraServers.push(...created.extraServers);
      }
      const server = app ? await this._listen(app, port) : null;
      if (server) this.servers.push(server);
      this.servers.push(...extraServers);
      this.challenges.push({
        id: mod.id,
        name: mod.name,
        category: mod.category,
        difficulty: mod.difficulty || 1,
        description: mod.description || '',
        hints: mod.hints || [],
        port,
        url: url || `http://127.0.0.1:${port}`,
        status: this.state.status(mod.id),
        _flag: flag,
        _dir: dir
      });
      console.log(`  [challenge] ${mod.id.padEnd(16)} ${category.padEnd(7)} port=${port}`);
    }
    return this.challenges.map(({ _flag, _dir, ...pub }) => pub);
  }

  async _createApp(mod, ctx) {
    let app;
    if (mod.createApp) {
      app = await mod.createApp(ctx);
    }
    if (!app) throw new Error(`挑战 ${mod.id} 未提供 createApp`);
    return app;
  }

  _listen(app, port) {
    return new Promise((resolve, reject) => {
      const server = app.listen(port, '0.0.0.0', () => resolve(server));
      server.on('error', reject);
    });
  }

  get(id) {
    return this.challenges.find((c) => c.id === id);
  }

  verify(id, flag) {
    const c = this.get(id);
    if (!c) return { ok: false, reason: 'unknown_challenge' };
    const correct = typeof flag === 'string' && flag.trim() === c._flag;
    if (correct) {
      this.state.markSolved(id, flag.trim());
    }
    return { ok: correct, solved: this.state.status(id).solved };
  }

  async stopAll() {
    for (const s of this.servers) await new Promise((r) => s.close(r));
    this.servers = [];
  }
}

module.exports = { ChallengeRunner, genFlag };
