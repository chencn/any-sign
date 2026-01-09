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
  const url = new URL(req.url);

  // 提取路径和参数，拼接到目标域名
  const targetUrl = new URL(url.pathname + url.search, UPSTREAM);

  // 构建请求头
  const headers = new Headers(req.headers);
  headers.set('host', new URL(UPSTREAM).host);
  headers.delete('content-length');

  // 中继请求
  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'follow'
  };

  if (!['GET', 'HEAD'].includes(req.method) && req.body) {
    init.body = req.body;
  }

  const resp = await fetch(targetUrl.toString(), init);

  // 返回响应
  return new Response(resp.body, {
    status: resp.status,
    headers: resp.headers
  });
}
