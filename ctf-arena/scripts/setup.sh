#!/usr/bin/env bash
# 初始化脚本：安装依赖并编译二进制题目
set -e
cd "$(dirname "$0")/.."

echo "[setup] 安装 npm 依赖..."
npm install

echo "[setup] 编译二进制题目..."
mkdir -p challenges/binary/bin
SRC=challenges/binary/src
OUT=challenges/binary/bin

if command -v gcc >/dev/null 2>&1; then
  gcc -o "$OUT/overflow" "$SRC/overflow.c" -fno-stack-protector -no-pie -O0 -Wall 2>/dev/null || \
    gcc -o "$OUT/overflow" "$SRC/overflow.c" -fno-stack-protector -O0 -Wall
  gcc -o "$OUT/format" "$SRC/format.c" -fno-stack-protector -no-pie -O0 -Wall
  gcc -o "$OUT/crackme" "$SRC/crackme.c" -no-pie -O0 -Wall
  echo "[setup] 编译完成: $(ls "$OUT")"
else
  echo "[setup] 警告: 未找到 gcc，二进制题目不可用（可安装 build-essential 后重试）"
fi

echo "[setup] 完成。运行: npm start   （AI 代理: npm run agent）"
