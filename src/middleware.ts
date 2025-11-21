import type { Request, Response } from 'express';
import type { IncomingHttpHeaders } from 'http';
import type { MiddlewareConfig } from './types.js';
import { WebhookManager } from './webhook.js';

//fast-proxy types
interface FastProxyOptions {
  base: string;
  undici?: {
    connections?: number;
    pipelining?: number;
    keepAliveTimeout?: number;
  };
  cacheURLs?: number;
  requests?: {
    http?: unknown;
    https?: unknown;
  };
}

interface ProxyRequestOptions {
  rewriteRequestHeaders?: (req: Request, headers: IncomingHttpHeaders) => IncomingHttpHeaders;
  rewriteHeaders?: (headers: IncomingHttpHeaders) => IncomingHttpHeaders;
  onResponse?: (req: Request, res: Response, stream: NodeJS.ReadableStream) => void;
  queryString?: string;
}

type ProxyFunction = (
  req: Request,
  res: Response,
  url: string,
  opts: ProxyRequestOptions
) => void;

interface FastProxyResult {
  proxy: ProxyFunction;
  close: () => void;
}

// Import fast-proxy using createRequire for ESM compatibility
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const createProxy = require('fast-proxy') as (opts: FastProxyOptions) => FastProxyResult;

export class ProxyMiddleware {
  private proxyFn: ProxyFunction;
  private closeProxy: () => void;
  private webhookManager: WebhookManager;

  constructor(private readonly config: MiddlewareConfig) {
    this.webhookManager = new WebhookManager(config);

    // Initialize fast-proxy with undici for maximum performance
    const { proxy, close } = createProxy({
      base: this.config.ghostUrl,
      // Use undici for 20-50% more throughput
      undici: {
        connections: 100,
        pipelining: 10,
        keepAliveTimeout: 60 * 1000,
      },
      // Cache parsed URLs for performance
      cacheURLs: 1000,
    });

    this.proxyFn = proxy;
    this.closeProxy = close;
  }

  /**
   * Rewrite request headers before sending to Ghost
   */
  private rewriteRequestHeaders = (req: Request, headers: IncomingHttpHeaders): IncomingHttpHeaders => {
    if (this.config.debug) {
      console.log('🔄 Proxying request:', req.method, req.url);
      console.log('📋 Request headers:', headers);
    }

    // Forward the client's real IP address
    const originalIp = headers['x-original-forwarded-for'] ||
                      headers['x-forwarded-for'] ||
                      req.socket?.remoteAddress ||
                      '';

    return {
      ...headers,
      'x-forwarded-for': originalIp as string,
      'x-real-ip': originalIp as string,
      'x-forwarded-proto': 'https',
    };
  };

  /**
   * Rewrite response headers before sending to client
   * Also captures cache invalidation headers for webhook triggering
   */
  private rewriteHeaders = (headers: IncomingHttpHeaders): IncomingHttpHeaders => {
    if (this.config.debug) {
      console.log('📋 Response headers:', headers);
    }

    // Check for cache invalidation header
    const cacheInvalidateHeader = headers['x-cache-invalidate'];
    if (cacheInvalidateHeader) {
      console.log(`🔄 Detected x-cache-invalidate header: ${cacheInvalidateHeader}`);
      // Trigger webhook asynchronously - don't block the response
      this.webhookManager.debouncePurgeCache(cacheInvalidateHeader as string).catch(console.error);
    }

    // Remove headers that might expose server information
    const filteredHeaders = { ...headers };
    delete filteredHeaders['x-powered-by'];
    delete filteredHeaders['server'];
    delete filteredHeaders['x-aspnet-version'];
    delete filteredHeaders['x-aspnetmvc-version'];

    return filteredHeaders;
  };

  /**
   * Handle proxy errors with a user-friendly error page
   */
  private handleProxyError(err: Error, req: Request, res: Response): void {
    console.error('❌ Error during proxy operation:', err);

    // The error page resembles the Ghost error page
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>We'll be right back</title>
<style type="text/css">
* {
    box-sizing: border-box;
}
html {
    font-size: 62.5%;
    background: #f1f2f3;
    -ms-text-size-adjust: 100%;
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}
body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    width: 100vw;
    margin: 0;
    padding: 4vmin;
    color: #15171A;
    font-size: 2rem;
    line-height: 1.4em;
    font-family: sans-serif;
    background: #f1f2f3;
    scroll-behavior: smooth;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}
::selection {
    text-shadow: none;
    background: #cbeafb;
}
.content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 500px;
    min-height: 360px;
    margin: 0 0 4vmin;
    padding: 40px;
    text-align: center;
    background: #fff;
    border-radius: 20px;
    box-shadow:
        0 50px 100px -20px rgb(50 50 93 / 8%),
        0 30px 60px -30px rgb(0 0 0 / 13%),
        0 10px 20px -10px rgb(0 0 0 / 8%);
}
h1 {
    margin: 0 0 0.3em;
    font-size: 4rem;
    line-height: 1em;
    font-weight: 700;
    letter-spacing: -0.02em;
}
p {
    margin: 0;
    opacity: 0.7;
    font-weight: 400;
}
@media (max-width: 500px) {
    body { font-size: 1.8rem; }
    h1 { font-size: 3.4rem; }
}
</style>
</head>
<body>
<div class="content">
    <h1>We'll be right back.</h1>
    <p>We're busy updating our site to give you the best experience, and will be back soon.</p>
</div>
</body>
</html>`;

    if (!res.headersSent) {
      res.status(503).send(errorHtml);
    }
  }

  /**
   * Main request handler - proxies requests to Ghost using fast-proxy + undici
   */
  public handleRequest = (req: Request, res: Response): void => {
    try {
      this.proxyFn(req, res, req.url || '/', {
        rewriteRequestHeaders: this.rewriteRequestHeaders,
        rewriteHeaders: this.rewriteHeaders,
      });
    } catch (err) {
      this.handleProxyError(err as Error, req, res);
    }
  };

  /**
   * Cleanup method to close proxy connections
   */
  public close(): void {
    this.closeProxy();
  }
}
