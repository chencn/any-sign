# Anyrouter Gateway

HTTP 请求中继服务，所有请求自动中继到 anyrouter.top

## 功能特性

- 🌐 自动域名替换，固定中继到 anyrouter.top
- 🚀 支持所有 HTTP 方法（GET/POST/PUT/DELETE/PATCH...）
- 📦 保留原始请求头和请求体
- 🎨 Apple HIG 风格使用说明页面
- 🐳 Docker 容器化部署

## 快速开始

### 使用 Docker

```bash
# 拉取镜像
docker pull ghcr.io/chencn/any-sign:latest

# 运行容器
docker run -d -p 7860:7860 ghcr.io/chencn/any-sign:latest
```

### 使用 Docker Compose

```bash
# 克隆仓库
git clone https://github.com/chencn/any-sign.git
cd any-sign

# 启动服务
docker-compose up -d
```

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/chencn/any-sign.git
cd any-sign

# 运行
deno task dev
```

## 使用方式

访问 `http://localhost:7860/` 查看完整使用说明

### 工作原理

所有请求的域名都会被替换成 `anyrouter.top`，只保留路径和参数：

```bash
# 客户端请求
curl http://localhost:7860/api/user/self

# 实际请求
https://anyrouter.top/api/user/self
```

### 基本示例

```bash
# GET 请求
curl http://localhost:7860/api/user/self

# POST 请求
curl -X POST http://localhost:7860/api/data \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 监听端口 | 7860 |

## GitHub Actions 自动构建

推送代码到 `main` 分支或创建 `v*` 标签会自动触发镜像构建：

```bash
# 创建 release 标签
git tag v1.0.0
git push origin v1.0.0
```

镜像会自动发布到 `ghcr.io/chencn/any-sign:latest`

## 技术栈

- Deno 2.1.4
- TypeScript
- Docker
- Apple HIG Design

## License

MIT