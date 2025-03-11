import fetch from 'node-fetch';
import type { MiddlewareConfig, InvalidationData } from './types.js';

export class WebhookManager {
  private cachePurgeTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceTime = 10000; // 10 seconds

  constructor(private readonly config: MiddlewareConfig) {}

  async debouncePurgeCache(pattern: string): Promise<void> {
    if (this.cachePurgeTimeout) {
      clearTimeout(this.cachePurgeTimeout);
    }
    
    this.cachePurgeTimeout = setTimeout(async () => {
      try {
        await this.triggerWebhook(pattern);
      } catch (error) {
        console.error('Failed to trigger webhook:', error);
      }
    }, this.debounceTime);
  }

  private async triggerWebhook(pattern: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      const invalidationData = this.parseInvalidationPattern(pattern);
      await this.sendWebhookRequest(invalidationData);
      
      const endTime = performance.now();
      console.log(`✅ Webhook triggered successfully in ${(endTime - startTime).toFixed(0)}ms`);
    } catch (error) {
      console.error('❌ Webhook trigger failed:', error);
      throw error;
    }
  }

  private parseInvalidationPattern(pattern: string): InvalidationData {
    // Ghost uses the pattern "/$/" to indicate a full site purge
    // It also uses "/*" for full site purge
    const purgeAll = pattern === '/$/' || pattern === '/*';
    
    // For specific URLs, Ghost sends patterns like:
    // - "/post-permalink" - Single post
    // - "/, /page/*, /rss" - Multiple pages
    // - "/page/*" - Wildcard paths
    const urls = purgeAll 
      ? ['/*'] 
      : pattern.split(',').map(url => url.trim());
    
    // From Ghost documentation, common patterns include:
    // - "/" - Home page
    // - "/page/*" - Paginated pages 
    // - "/rss" - RSS feed
    // - "/post-permalink" - Specific post URL
    
    return {
      urls,
      purgeAll,
      pattern,
      timestamp: new Date().toISOString()
    };
  }

  private async sendWebhookRequest(data: InvalidationData): Promise<void> {
    const { webhook } = this.config;
    
    // Process the body template
    const body = this.processTemplate(webhook.bodyTemplate, data);
    
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.processHeaderTemplates(webhook.headers || {}, webhook.secret)
    };

    // Retry logic
    for (let attempt = 1; attempt <= webhook.retryCount; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: webhook.method,
          headers,
          body
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error ${response.status}: ${errorText}`);
        }
        
        return; // Success
      } catch (error) {
        if (attempt === webhook.retryCount) {
          throw error; // Last attempt failed
        }
        
        console.warn(`Webhook attempt ${attempt} failed, retrying in ${webhook.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, webhook.retryDelay));
      }
    }
  }

  private processTemplate(template: string, data: InvalidationData): string {
    return template
      .replace(/\${urls}/g, JSON.stringify(data.urls))
      .replace(/\${purgeAll}/g, JSON.stringify(data.purgeAll))
      .replace(/\${timestamp}/g, JSON.stringify(data.timestamp).replace(/^"|"$/g, ''))
      .replace(/\${pattern}/g, JSON.stringify(data.pattern));
  }

  private processHeaderTemplates(
    headers: Record<string, string>,
    secret?: string
  ): Record<string, string> {
    const processedHeaders: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      processedHeaders[key] = value.replace(/\${secret}/g, secret || '');
    }
    
    return processedHeaders;
  }
} 