import { z } from 'zod';
import dotenv from 'dotenv';
import type { MiddlewareConfig } from './types.js'

// Schema for runtime environment validation
const baseSchema = z.object({
  GHOST_URL: z.string().url().default('http://localhost:2368'),
  GHOST_PUBLIC_URL: z.string().url().optional(),
  PORT: z.string().transform(Number).default('3000'),
  DEBUG: z.string().transform(val => val === 'true').default('false'),
  WEBHOOK_URL: z.string().url(),
});

const configSchema = z.object({
  ...baseSchema.shape,
  WEBHOOK_METHOD: z.string().default('POST'),
  WEBHOOK_SECRET: z.string().optional(),
  WEBHOOK_HEADERS: z.string().optional().transform(val => {
    if (!val) return undefined;
    try {
      return JSON.parse(val);
    } catch (e) {
      throw new Error(`Invalid JSON in WEBHOOK_HEADERS: ${(e as Error).message}`);
    }
  }),
  WEBHOOK_BODY_TEMPLATE: z.string().default('{"urls": ${urls}, "timestamp": "${timestamp}", "purgeAll": ${purgeAll}}')
    .transform(val => {
      // Don't try to validate as JSON, just check for balanced braces and obvious issues
      const openBraces = (val.match(/{/g) || []).length;
      const closeBraces = (val.match(/}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        throw new Error(`Invalid template: Unbalanced braces (${openBraces} opening, ${closeBraces} closing)`);
      }
      
      // Check that we have our expected variables
      if (!val.includes('${urls}') && !val.includes('${purgeAll}') && !val.includes('${timestamp}') && !val.includes('${pattern}')) {
        console.warn('Warning: Template contains none of the expected variables (${urls}, ${purgeAll}, ${timestamp}, ${pattern})');
      }
      
      return val;
    }),
  WEBHOOK_RETRY_COUNT: z.string().transform(Number).default('3'),
  WEBHOOK_RETRY_DELAY: z.string().transform(Number).default('1000'),
});

export function loadConfig(): MiddlewareConfig {
  dotenv.config();
  
  const result = configSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid configuration:', result.error.format());
    process.exit(1);
  }

  const { data } = result;

  return {
    ghostUrl: data.GHOST_URL.replace(/\/$/, ''),
    ghostPublicUrl: data.GHOST_PUBLIC_URL?.replace(/\/$/, ''),
    port: data.PORT,
    debug: data.DEBUG,
    webhook: {
      url: data.WEBHOOK_URL,
      method: data.WEBHOOK_METHOD,
      secret: data.WEBHOOK_SECRET,
      headers: data.WEBHOOK_HEADERS,
      bodyTemplate: data.WEBHOOK_BODY_TEMPLATE,
      retryCount: data.WEBHOOK_RETRY_COUNT,
      retryDelay: data.WEBHOOK_RETRY_DELAY,
    },
    security: {
      trustProxy: true,
    }
  };
} 