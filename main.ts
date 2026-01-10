const UPSTREAM = 'https://anyrouter.top';

const port = parseInt(Deno.env.get('PORT') || '7860');

// Cookie 缓存：{ sessionId:url => { cookie, expiry } }
const cookieCache = new Map<string, { cookie: string; expiry: number }>();

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
    const originalCookie = req.headers.get('cookie') || '';

    // 从原始 Cookie 中提取 sessionId
    const sessionId = extractSessionId(originalCookie);

    // 构建请求头
    const headers = new Headers(req.headers);
    headers.set('host', new URL(UPSTREAM).host);
    headers.delete('content-length');
    headers.delete('connection');
    headers.delete('keep-alive');
    headers.delete('transfer-encoding');
    headers.delete('upgrade');

    // 获取动态 Cookie（按 sessionId 缓存）
    const { cookie, error } = await getDynamicCookieWithCache(targetUrl, sessionId);
    if (!cookie) {
      return new Response(JSON.stringify({
        error: 'Failed to obtain dynamic cookie',
        details: error,
        code: 'COOKIE_ERROR'
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
      redirect: 'manual',
      signal: AbortSignal.timeout(30000)
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
    console.error('[Relay Error]', error);

    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    const isAbort = error instanceof Error && error.name === 'AbortError';

    return new Response(JSON.stringify({
      error: 'Gateway error',
      message: error instanceof Error ? error.message : String(error),
      code: isTimeout || isAbort ? 'TIMEOUT' : 'UNKNOWN'
    }), {
      status: isTimeout || isAbort ? 504 : 502,
      headers: { 'content-type': 'application/json' }
    });
  }
}

// 从 Cookie 字符串中提取 sessionId
function extractSessionId(cookieString: string): string {
  if (!cookieString) return 'anonymous';

  // 匹配 session=xxx 或 sessionid=xxx 或 PHPSESSID=xxx 等常见格式
  const patterns = [
    /session=([^;]+)/i,
    /sessionid=([^;]+)/i,
    /phpsessid=([^;]+)/i,
    /jsessionid=([^;]+)/i,
    /sid=([^;]+)/i,
  ];

  for (const pattern of patterns) {
    const match = cookieString.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 如果没有明确的 session，使用整个 Cookie 字符串的哈希作为标识
  // 这样不同的 Cookie 组合会被视为不同的"用户"
  return hashString(cookieString);
}

// 简单的字符串哈希函数
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

async function getDynamicCookieWithCache(targetUrl: URL, sessionId: string): Promise<{ cookie: string | null; error: string | null }> {
  // 缓存键：sessionId + URL路径
  const cacheKey = `${sessionId}:${targetUrl.origin}${targetUrl.pathname}`;
  const now = Date.now();

  // 检查缓存
  const cached = cookieCache.get(cacheKey);
  if (cached && cached.expiry > now) {
    return { cookie: cached.cookie, error: null };
  }

  // 获取新 Cookie
  const result = await getDynamicCookie(targetUrl);

  // 缓存成功的 Cookie（5分钟有效期）
  if (result.cookie) {
    cookieCache.set(cacheKey, {
      cookie: result.cookie,
      expiry: now + 5 * 60 * 1000  // 5分钟
    });
  }

  return result;
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
      signal: AbortSignal.timeout(10000)  // 10秒超时
    });

    const html = await challengeResp.text();
    const { cookie, error } = extractCookieFromHtml(html);
    return { cookie, error };
  } catch (err) {
    return { cookie: null, error: `Fetch failed: ${String(err)}` };
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

  try {
    // 使用 Function 构造器，显式传递沙箱变量
    const sandbox = new Function(
      'document',
      'location',
      'window',
      'self',
      'navigator',
      scriptContent
    );

    // 执行脚本，传入模拟的浏览器对象
    sandbox(
      document,           // document
      document.location,  // location
      {},                 // window
      {},                 // self
      {}                  // navigator
    );
  } catch (err) {
    return { cookie: null, error: `Script error: ${String(err)}` };
  }

  if (cookieValue) {
    return { cookie: cookieValue.split(';')[0], error: null };
  }
  return { cookie: null, error: 'script executed but did not set cookie' };
}
