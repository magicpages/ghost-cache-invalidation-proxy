import express, { Request, Response, NextFunction } from 'express';
import { loadConfig } from './config.js';
import { ProxyMiddleware } from './middleware.js';

async function bootstrap() {
  try {
    const config = loadConfig();
    const app = express();
    
    // Disable X-Powered-By header for security
    app.disable('x-powered-by');
    
    // Basic security
    app.set('trust proxy', config.security.trustProxy);
    
    // Normalize paths
    app.use((req: Request, res: Response, next: NextFunction) => {
      req.url = req.url.replace(/\/+/g, '/');
      next();
    });

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'ghost-cache-invalidation-proxy'
      });
    });

    // Setup proxy middleware
    const proxyMiddleware = new ProxyMiddleware(config);
    app.use(proxyMiddleware.handleRequest);

    // Start server
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
      config.debug && console.log('🐛 Debug mode enabled');
      console.log(`🔗 Connected to Ghost CMS at ${config.ghostUrl}`);
      if (config.ghostPublicUrl) {
        console.log(`🌐 Public site URL: ${config.ghostPublicUrl}`);
      }
      console.log(`📣 Webhook configured at ${config.webhook.url}`);
    });
  } catch (error: unknown) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap().catch(console.error);

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 