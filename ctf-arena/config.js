'use strict';

/**
 * 平台全局配置
 * 所有端口均可通过环境变量覆盖，便于部署与 AI 自动化。
 */
const path = require('path');

const ROOT = path.join(__dirname, '..');

function int(v, d) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

module.exports = {
  root: ROOT,
  // 平台主服务端口（/api/* 与计分板）
  port: int(process.env.PORT, 3000),
  // 挑战基础端口，各挑战按注册顺序递增
  challengeBasePort: int(process.env.CHALLENGE_BASE_PORT, 20000),
  // 内网渗透靶场入口端口
  networkBasePort: int(process.env.NETWORK_BASE_PORT, 21000),
  // 数据目录（状态持久化、Flag 文件等）
  dataDir: path.join(ROOT, 'data'),
  stateFile: path.join(ROOT, 'data', 'state.json'),
  // 是否输出请求日志
  verbose: process.env.VERBOSE === '1',
  // AI 代理默认模型配置
  llm: {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    maxRounds: int(process.env.LLM_MAX_ROUNDS, 40)
  }
};
