# Anyrouter Sign Proxy

Anyrouter 动态 Cookie 反向代理服务，自动处理 `acw_sc__v2` 验证

## 功能特性

- 🔐 自动获取并注入动态 Cookie
- 🚀 Deno 运行时，轻量高效
- 🐳 Docker 容器化部署
- 🔍 内置 Debug 调试页面

## 快速部署

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

# 修改 docker-compose.yml 中的镜像地址
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

访问 `http://localhost:7860/` 查看调试页面

代理目标 API：
```bash
curl http://localhost:7860/api/user/self
```

## GitHub Actions 自动构建

推送代码到 `main` 分支或创建 `v*` 标签会自动触发镜像构建：

```bash
# 创建 release 标签
git tag v1.0.0
git push origin v1.0.0
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 监听端口 | 7860 |

## 技术栈

- Deno 2.1.4
- TypeScript
- Docker

## License

MIT