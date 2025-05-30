import type { Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import httpProxy from 'http-proxy';
import type { MiddlewareConfig } from './types.js';
import { WebhookManager } from './webhook.js';

export class ProxyMiddleware {
  private proxy: httpProxy;
  private webhookManager: WebhookManager;

  constructor(private readonly config: MiddlewareConfig) {
    this.webhookManager = new WebhookManager(config);
    this.proxy = this.createProxy();
  }

  private createProxy(): httpProxy {
    const proxy = httpProxy.createProxyServer({
      target: this.config.ghostUrl,
      secure: false,
      changeOrigin: true,
      selfHandleResponse: true,
      xfwd: true,
      headers: {
        'X-Forwarded-Proto': 'https'
      }
    });

    this.setupProxyEventHandlers(proxy);
    return proxy;
  }

  private setupProxyEventHandlers(proxy: httpProxy): void {
    proxy.on('proxyReq', (proxyReq: any, req: any, res: any, options: any) => {
      this.handleProxyRequest(proxyReq, req as Request, res as Response, options);
    });
    proxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
      this.handleProxyResponse(proxyRes, req as Request, res as Response);
    });
    proxy.on('error', (err: Error, req: any, res: any) => {
      this.handleProxyError(err, req as Request, res as Response);
    });
  }

  private handleProxyRequest(
    proxyReq: any,
    req: Request,
    res: Response,
    options: httpProxy.ServerOptions
  ): void {
    if (this.config.debug) {
      console.log('🔄 Proxying request:', req.method, req.url);
      console.log('📋 Headers:', req.headers);
    }

    // Forward the client's real IP address
    const originalIp = req.headers['x-original-forwarded-for'] || 
                      req.headers['x-forwarded-for'] || 
                      req.connection.remoteAddress;
    proxyReq.setHeader('x-forwarded-for', originalIp as string);
    proxyReq.setHeader('x-real-ip', originalIp as string);

    // Handle raw body if available (for multipart form data, etc.)
    if ((req as any).rawBody?.length > 0) {
      proxyReq.setHeader('Content-Length', (req as any).rawBody.length.toString());
      proxyReq.write((req as any).rawBody);
    }
  }

  private handleProxyResponse(
    proxyRes: IncomingMessage,
    req: Request,
    res: Response
  ): void {
    if (this.config.debug) {
      console.log('↩️ Response:', proxyRes.statusCode, req.method, req.url);
      console.log('📋 Response headers:', proxyRes.headers);
    }

    // Filter out potentially sensitive headers
    const filteredHeaders = { ...proxyRes.headers };
    
    // Remove headers that might expose server information
    delete filteredHeaders['x-powered-by'];
    delete filteredHeaders['server'];
    delete filteredHeaders['x-aspnet-version'];
    delete filteredHeaders['x-aspnetmvc-version'];
    
    // Forward the response headers and status code
    res.writeHead(proxyRes.statusCode || 200, filteredHeaders);
    
    // Pipe the response body
    proxyRes.pipe(res);

    // Check for cache invalidation header when the response ends
    proxyRes.on('end', () => {
      const cacheInvalidateHeader = proxyRes.headers['x-cache-invalidate'];
      if (cacheInvalidateHeader) {
        console.log(`🔄 Detected x-cache-invalidate header: ${cacheInvalidateHeader}`);
        // Pass the invalidation pattern to the webhook manager
        this.webhookManager.debouncePurgeCache(cacheInvalidateHeader as string).catch(console.error);
      }
    });
  }

  private handleProxyError(err: Error, req: Request, res: Response): void {
    console.error('❌ Error during proxy operation:', err);
    
    // The error page resembles the Ghost error page
    // @see: https://github.com/TryGhost/Ghost/blob/ec62120b94ccce06b56ae1ca6944ab87644437bd/ghost/core/core/server/views/maintenance.html#L84
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
img {
    display: block;
    margin: 0 auto 40px;
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
    
    res.status(503).send(errorHtml);
  }

  public handleRequest = (req: Request, res: Response): void => {
    this.proxy.web(req, res, { target: this.config.ghostUrl });
  };
} 