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
    const targetUrl = new URL(url.pathname + url.search, UPSTREAM);

    // 总是获取动态 Cookie（anyrouter 需要 acw_sc__v2）
    const originalCookie = req.headers.get('cookie') || '';

    // 构建请求头
    const headers = new Headers(req.headers);
    headers.set('host', new URL(UPSTREAM).host);
    headers.delete('content-length');
    headers.delete('connection');
    headers.delete('keep-alive');
    headers.delete('transfer-encoding');
    headers.delete('upgrade');

    // 获取动态 Cookie
    const { cookie, error } = await getDynamicCookie(targetUrl);
    if (!cookie) {
      return new Response(JSON.stringify({
        error: 'Failed to obtain dynamic cookie',
        details: error
      }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      });
    }
    // 合并动态 Cookie 和原始 Cookie
    headers.set('cookie', [cookie, originalCookie].filter(Boolean).join('; '));

    // 中继请求
    const init: RequestInit = {
      method: req.method,
      headers,
      redirect: 'manual'  // 改为 manual，避免无限重定向
    };

    // 处理请求体
    if (!['GET', 'HEAD'].includes(req.method)) {
      const body = await req.arrayBuffer();
      if (body.byteLength > 0) {
        init.body = body;
      }
    }

    const resp = await fetch(targetUrl.toString(), init);

    // 返回响应
    const responseHeaders = new Headers(resp.headers);

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders
    });
  } catch (error) {
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

async function getDynamicCookie(targetUrl: URL): Promise<{ cookie: string | null; error: string | null }> {
  try {
    const challengeResp = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'manual',
    });

    const html = await challengeResp.text();
    const { cookie, error } = extractCookieFromHtml(html);
    return { cookie, error };
  } catch (err) {
    return { cookie: null, error: String(err) };
  }
}

function extractCookieFromHtml(html: string): { cookie: string | null; error: string | null } {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) {
    return { cookie: null, error: 'no <script> tags found' };
  }

  let lastError: string | null = null;
  for (const match of scripts) {
    const scriptContent = match[1];
    const { cookie, error } = executeScriptForCookie(scriptContent);
    if (cookie) return { cookie, error: null };
    lastError = error;
  }

  return { cookie: null, error: lastError || 'no cookie produced' };
}

function executeScriptForCookie(scriptContent: string): { cookie: string | null; error: string | null } {
  let cookieValue: string | null = null;

  const document = {
    _cookie: '',
    set cookie(val: string) {
      this._cookie = val;
      cookieValue = val;
    },
    get cookie() {
      return this._cookie;
    },
    location: { reload() {} },
  };
  const location = document.location;
  const windowObj: Record<string, unknown> = {};
  const selfObj = windowObj;
  const navigator = {};

  try {
    const wrapped = `(function(){${scriptContent}\n})();`;
    eval(wrapped);
  } catch (err) {
    return { cookie: null, error: String(err) };
  }

  if (cookieValue) {
    return { cookie: cookieValue.split(';')[0], error: null };
  }
  return { cookie: null, error: 'script executed but did not set cookie' };
}
