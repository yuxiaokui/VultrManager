'use strict';

/**
 * 挑战状态管理（JSON 持久化）
 */
const fs = require('fs');
const path = require('path');

class StateStore {
  constructor(file) {
    this.file = file;
    this.data = { challenges: {}, submissions: [] };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      }
    } catch (e) {
      console.warn('[state] 状态文件损坏，重置:', e.message);
      this.data = { challenges: {}, submissions: [] };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  /** 记录一次 flag 提交，返回 { correct, solved } */
  submit(challengeId, flag) {
    const rec = this.data.challenges[challengeId] || (this.data.challenges[challengeId] = {
      solved: false, attempts: 0, solvedAt: null
    });
    rec.attempts += 1;
    this.data.submissions.push({
      challengeId, flag, at: new Date().toISOString(), correct: false
    });
    this.save();
    return { correct: false, solved: rec.solved };
  }

  markSolved(challengeId, flag) {
    const rec = this.data.challenges[challengeId] || (this.data.challenges[challengeId] = {
      solved: false, attempts: 0, solvedAt: null
    });
    rec.solved = true;
    rec.solvedAt = new Date().toISOString();
    const s = this.data.submissions[this.data.submissions.length - 1];
    if (s && s.challengeId === challengeId) s.correct = true;
    this.save();
  }

  status(challengeId) {
    return this.data.challenges[challengeId] || { solved: false, attempts: 0, solvedAt: null };
  }

  allStatus() {
    return this.data.challenges;
  }
}

module.exports = StateStore;
