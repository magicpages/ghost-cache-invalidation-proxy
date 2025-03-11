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

    // Forward the response headers and status code
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    
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
    
    // Send a nicer error page
    const errorHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Service Temporarily Unavailable</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                 text-align: center; padding-top: 50px; }
          h1 { color: #333; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <h1>Service Temporarily Unavailable</h1>
        <p>The server is temporarily unable to service your request due to maintenance downtime or capacity problems. Please try again later.</p>
      </body>
    </html>
    `;
    
    res.status(503).send(errorHtml);
  }

  public handleRequest = (req: Request, res: Response): void => {
    this.proxy.web(req, res, { target: this.config.ghostUrl });
  };
} 