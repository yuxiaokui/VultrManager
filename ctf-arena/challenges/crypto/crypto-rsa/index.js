'use strict';

/**
 * 挑战：RSA 弱密钥分解（p、q 过于接近）
 * 服务端用两个非常接近的 64 位素数作为 RSA 模数（无填充），flag 明文可直接解密。
 * 解法：p、q 接近 -> 用 Fermat 分解法在数步内分解 n，或写 Pollard rho / 用工具。
 */
const express = require('express');

const FLAG = 'flag{rsa_small}'; // 15 字节 < 128 位，可被 n 加密

// ---------- 确定性素数生成（Miller-Rabin，n < 2^64 确定性） ----------
function modPow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

function isPrime(n) {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n % p === 0n) return n === p;
  }
  let d = n - 1n;
  let s = 0;
  while (d % 2n === 0n) { d /= 2n; s++; }
  const bases = [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n];
  outer:
  for (const a of bases) {
    if (a % n === 0n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

function nextPrime(n) {
  while (!isPrime(n)) n++;
  return n;
}

// 生成两个非常接近的 64 位素数（便于 Fermat 分解）
let p = nextPrime(2n ** 64n - 1000000n);
let q = nextPrime(p + 1n);
let phi = (p - 1n) * (q - 1n);
const e = 65537n;
while (phi % e === 0n) { // 极小概率：确保 gcd(e, phi) = 1
  p = nextPrime(p + 1n);
  q = nextPrime(p + 1n);
  phi = (p - 1n) * (q - 1n);
}
const n = p * q;

function modInv(a, m) {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const qq = old_r / r;
    [old_r, r] = [r, old_r - qq * r];
    [old_s, s] = [s, old_s - qq * s];
  }
  return ((old_s % m) + m) % m;
}

const d = modInv(e, phi);
const m = BigInt('0x' + Buffer.from(FLAG, 'utf8').toString('hex'));
const c = modPow(m, e, n);

module.exports = {
  id: 'crypto-rsa',
  name: 'RSA 弱密钥分解（Fermat）',
  category: 'crypto',
  difficulty: 3,
  description:
    '服务端用 RSA 加密 flag（无填充），但两个素数 p、q 非常接近，模数可被快速分解。\n' +
    '接口：GET /challenge 返回 { n, e, c }\n' +
    '已知：e=65537，明文是短 UTF-8 文本（flag）。',
  hints: [
    'p、q 都是约 2^64 的数且非常接近',
    'p、q 接近时用 Fermat 分解法：令 a=ceil(sqrt(n))，寻找使 a^2-n 为完全平方数的 a，则 p=a-b, q=a+b',
    '算出 d=e^-1 mod (p-1)(q-1) 后 m=c^d mod n，转字节即 flag'
  ],
  flag: FLAG,
  createApp() {
    const app = express();

    app.get('/', (_req, res) => {
      res.json({ name: 'RSA 弱密钥分解', challenge: 'GET /challenge 获取公钥与密文' });
    });

    app.get('/challenge', (_req, res) => {
      res.json({ n: n.toString(), e: e.toString(), c: c.toString(), note: '明文为 UTF-8 字符串，即 flag' });
    });

    return app;
  }
};
