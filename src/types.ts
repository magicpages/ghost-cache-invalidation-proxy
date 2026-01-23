export interface MiddlewareConfig {
  ghostUrl: string;
  ghostPublicUrl?: string;
  port: number;
  debug: boolean;
  webhook: {
    url: string;
    method: string;
    secret?: string;
    headers?: Record<string, string>;
    bodyTemplate: string;
    retryCount: number;
    retryDelay: number;
  };
  proxyTimeout: number;
  webhookTimeout: number;
  security: {
    trustProxy: boolean;
  };
}

export interface InvalidationData {
  urls: string[];
  purgeAll: boolean;
  pattern: string;
  timestamp: string;
} 