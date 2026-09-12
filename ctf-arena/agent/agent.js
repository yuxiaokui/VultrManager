'use strict';

/**
 * AI 自动渗透代理
 *
 * 让任意 OpenAI 兼容的 LLM（GPT / DeepSeek / 通义 / Moonshot...）通过
 * "函数调用" 循环自动攻击 CTF 靶场：探测 -> 分析 -> 编写脚本 -> 提交 flag。
 *
 * 用法：
 *   LLM_API_KEY=xxx LLM_BASE_URL=https://api.deepseek.com/v1 LLM_MODEL=deepseek-chat \
 *   PLATFORM_URL=http://127.0.0.1:3000 npm run agent
 *
 * 可选参数：
 *   node agent/agent.js --challenge web-sqli   只攻击指定挑战
 *   node agent/agent.js --all                  重新攻击已通关的挑战
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../config');

const PLATFORM = process.env.PLATFORM_URL || `http://127.0.0.1:${config.port}`;
const WORKSPACE = path.join(__dirname, 'workspace');
fs.mkdirSync(WORKSPACE, { recursive: true });

// ---------- 工具定义（OpenAI 兼容 function calling） ----------
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'http_request',
      description: '向任意 URL 发送 HTTP 请求并返回响应状态与正文（AI 渗透的主要交互手段）',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '完整 URL，如 http://127.0.0.1:20000/login?username=a' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
          headers: { type: 'object', description: '自定义请求头，如 {"X-Auth-Token":"abc"}' },
          json: { type: 'object', description: '以 JSON 发送的请求体' },
          body: { type: 'string', description: '原始字符串请求体' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'submit_flag',
      description: '向平台提交 flag，验证是否正确（解题成功信号）',
      parameters: {
        type: 'object',
        properties: {
          challenge_id: { type: 'string' },
          flag: { type: 'string' }
        },
        required: ['challenge_id', 'flag']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: '在本地 shell 执行命令（写 Python 脚本、运行 objdump、扫描端口等），工作目录 agent/workspace，超时 30 秒',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要执行的 shell 命令，如 python3 solve.py' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: '在 agent/workspace 下写入文件（如解题脚本 solve.py）',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对路径，如 solve.py' },
          content: { type: 'string' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取 agent/workspace 下的文件',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path']
      }
    }
  }
];

// ---------- 工具执行 ----------
const TRIM = 6000;
function truncate(s) {
  s = String(s);
  return s.length > TRIM ? s.slice(0, TRIM) + '\n...[截断]' : s;
}

async function httpRequest({ url, method = 'GET', headers = {}, json, body }) {
  const opts = { method, headers: { ...headers } };
  if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  } else if (body !== undefined) {
    opts.body = String(body);
  }
  try {
    const resp = await fetch(url, opts);
    const text = await resp.text();
    return {
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
      body: truncate(text)
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function submitFlag({ challenge_id, flag }) {
  const resp = await fetch(`${PLATFORM}/api/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_id, flag: String(flag).trim() })
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: data.ok === true, solved: !!data.solved, raw: data };
}

async function runCommand({ command }) {
  try {
    const out = execSync(command, { cwd: WORKSPACE, shell: '/bin/bash', timeout: 30000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { exitCode: 0, output: truncate(out) };
  } catch (e) {
    return { exitCode: e.status ?? -1, output: truncate((e.stdout || '') + (e.stderr || '') + (e.message || '')) };
  }
}

async function writeFile({ path: p, content }) {
  const fp = path.join(WORKSPACE, p);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
  return { ok: true, path: fp };
}

async function readFile({ path: p }) {
  try {
    return { ok: true, content: truncate(fs.readFileSync(path.join(WORKSPACE, p), 'utf8')) };
  } catch (e) {
    return { error: e.message };
  }
}

const HANDLERS = { http_request: httpRequest, submit_flag: submitFlag, run_command: runCommand, write_file: writeFile, read_file: readFile };

// ---------- LLM 交互 ----------
async function chat(messages) {
  const { baseUrl, apiKey, model } = config.llm;
  if (!apiKey) throw new Error('缺少 LLM_API_KEY，请在环境变量中配置（OpenAI 兼容接口）');
  const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, tools: TOOLS, temperature: 0.2, max_tokens: 4000 })
  });
  if (!resp.ok) {
    throw new Error(`LLM 接口错误 ${resp.status}: ${truncate(await resp.text())}`);
  }
  return resp.json();
}

function systemPrompt(ch) {
  return `你是专业的 AI 渗透测试代理，正在攻击一个 CTF 靶场。当前挑战信息：
${JSON.stringify(ch, null, 2)}

规则：
1. 通过 http_request 与目标服务交互（接口与提示已在上文给出）。
2. 需要计算/爆破/逆向时，用 write_file 写 Python 脚本，再用 run_command 执行。
3. 发现 flag 后立即调用 submit_flag（challenge_id 见上），返回 {ok:true} 即通关。
4. 不要提交猜测的错误 flag；确认是 flag{...} 格式再提交。
5. 一次只做一件事，逐步推进，善于利用 hints。
6. 通关后简要总结攻击路径。`;
}

async function solveChallenge(ch) {
  console.log(`\n===== 开始攻击: ${ch.id} (${ch.name}) ${ch.url} =====`);
  const messages = [
    { role: 'system', content: systemPrompt(ch) },
    { role: 'user', content: '开始解题，先探测目标。' }
  ];
  const t0 = Date.now();
  for (let round = 0; round < config.llm.maxRounds; round++) {
    let resp;
    try {
      resp = await chat(messages);
    } catch (e) {
      console.error(`[agent] LLM 调用失败: ${e.message}`);
      return { id: ch.id, solved: false, error: e.message };
    }
    const msg = resp.choices[0]?.message;
    if (!msg) {
      console.error('[agent] 无模型回复:', truncate(JSON.stringify(resp)));
      return { id: ch.id, solved: false, error: 'empty response' };
    }

    if (msg.tool_calls && msg.tool_calls.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        const fn = tc.function;
        let result;
        try {
          const args = JSON.parse(fn.arguments || '{}');
          console.log(`  [tool] ${fn.name} ${truncate(JSON.stringify(args)).slice(0, 200)}`);
          result = await HANDLERS[fn.name](args);
        } catch (e) {
          result = { error: e.message };
        }
        if (fn.name === 'submit_flag') {
          console.log(`  [submit] -> ${JSON.stringify(result)}`);
          if (result.ok) {
            console.log(`\n  ✓ 挑战 ${ch.id} 通关！耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
            return { id: ch.id, solved: true };
          }
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: truncate(JSON.stringify(result)) });
      }
    } else {
      // 模型直接给出结论：尝试从中提取 flag 提交
      const content = msg.content || '';
      const m = content.match(/flag\{[^}\s]+\}/);
      if (m) {
        const r = await submitFlag({ challenge_id: ch.id, flag: m[0] });
        console.log(`  [text-flag] ${m[0]} -> ${JSON.stringify(r)}`);
        if (r.ok) {
          console.log(`\n  ✓ 挑战 ${ch.id} 通关！耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
          return { id: ch.id, solved: true };
        }
      }
      messages.push(msg);
      console.log(`  [模型] ${truncate(content).slice(0, 300)}`);
      if (round > 1 && !m) {
        console.log(`  [agent] 模型未继续调用工具，结束该挑战`);
        break;
      }
    }
  }
  console.log(`  ✗ 挑战 ${ch.id} 未能通关（达到轮次上限）`);
  return { id: ch.id, solved: false };
}

async function main() {
  const args = process.argv.slice(2);
  const onlyId = args.indexOf('--challenge') !== -1 ? args[args.indexOf('--challenge') + 1] : null;
  const redo = args.includes('--all');

  const listResp = await fetch(`${PLATFORM}/api/challenges`).catch(() => null);
  if (!listResp) {
    console.error(`无法连接平台 ${PLATFORM}，请先启动: npm start`);
    process.exit(1);
  }
  const challenges = await listResp.json();
  console.log(`[agent] 平台挑战列表（${challenges.length} 道）`);
  for (const c of challenges) {
    console.log(`  - ${c.id.padEnd(16)} [${c.category}] 难度${c.difficulty} ${c.solved ? '(已通关)' : ''}`);
  }

  const targets = challenges.filter((c) => {
    if (onlyId) return c.id === onlyId;
    return redo || !c.status?.solved;
  });
  if (!targets.length) {
    console.log('[agent] 没有待攻击的挑战（使用 --all 重新攻击，或 --challenge <id> 指定）');
    return;
  }

  const results = [];
  for (const ch of targets) {
    results.push(await solveChallenge(ch));
  }

  const solved = results.filter((r) => r.solved).length;
  console.log(`\n========== 最终报告: ${solved}/${results.length} 通关 ==========`);
  for (const r of results) console.log(`  ${r.solved ? '✓' : '✗'} ${r.id}${r.error ? '  (' + r.error + ')' : ''}`);
}

main().catch((e) => {
  console.error('[agent] 运行失败:', e.message);
  process.exit(1);
});
