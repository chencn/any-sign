const UPSTREAM = 'https://anyrouter.top';

const port = parseInt(Deno.env.get('PORT') || '7860');

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);

  // 首页返回使用说明
  if (url.pathname === '/') {
    return new Response(await Deno.readTextFile('./index.html'), {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  // 其他所有请求中继到 anyrouter.top
  return relayRequest(req);
});

async function relayRequest(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);

    // 提取路径和参数，拼接到目标域名
    const targetUrl = new URL(url.pathname + url.search, UPSTREAM);

    // 构建请求头
    const headers = new Headers(req.headers);
    headers.set('host', new URL(UPSTREAM).host);

    // 移除可能导致冲突的 headers
    headers.delete('content-length');
    headers.delete('connection');
    headers.delete('keep-alive');
    headers.delete('transfer-encoding');
    headers.delete('upgrade');

    // 中继请求
    const init: RequestInit = {
      method: req.method,
      headers,
      redirect: 'follow'
    };

    // 处理请求体
    if (!['GET', 'HEAD'].includes(req.method)) {
      const body = await req.arrayBuffer();
      if (body.byteLength > 0) {
        init.body = body;
      }
    }

    const resp = await fetch(targetUrl.toString(), init);

    // 返回响应（完整复制所有响应头）
    const responseHeaders = new Headers(resp.headers);

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    // 错误处理
    console.error('Relay error:', error);
    return new Response(JSON.stringify({
      error: 'Gateway error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 502,
      headers: { 'content-type': 'application/json' }
    });
  }
}
