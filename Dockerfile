# Deno 运行时镜像
FROM denoland/deno:2.1.4

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY deno.json .
COPY main.ts .

# 缓存依赖（利用 Docker layer cache）
RUN deno cache main.ts

# Hugging Face Spaces 默认端口
ENV PORT=7860
EXPOSE 7860

# 启动应用
CMD ["deno", "run", "--allow-net", "--allow-env", "main.ts"]
