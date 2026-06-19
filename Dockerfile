# Deno 运行时镜像
FROM denoland/deno:2.1.4

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY deno.json .
COPY main.ts .
COPY docker-entrypoint.sh .
COPY index.html .
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# 缓存依赖（利用 Docker layer cache）
RUN deno cache main.ts

# Hugging Face Spaces 默认端口
ENV PORT=7860
EXPOSE 7860

# HOST_OVERRIDES 需要在启动时追加 /etc/hosts
USER root
ENTRYPOINT ["./docker-entrypoint.sh"]

# 启动应用
CMD ["deno", "run", "--allow-net", "--allow-env=PORT", "--allow-read=/app", "main.ts"]
