# AI CTF Arena - 容器化部署
# 需要 Node 18+ / gcc / python3 来编译二进制题目
FROM node:20-bookworm

WORKDIR /app

# 安装编译工具链
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# 安装依赖（利用缓存层）
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# 复制源码
COPY . .

# 编译二进制题目
RUN npm run setup

# 平台端口 + 挑战端口（web/crypto/binary）+ 内网渗透端口
EXPOSE 3000 20000-20012 21000-21002

CMD ["node", "platform/server.js"]
