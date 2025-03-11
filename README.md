# Ghost Cache Invalidation Proxy

## Overview

This proxy sits between a Ghost CMS instance and clients. It monitors responses from Ghost for the `X-Cache-Invalidate` header and triggers configured webhooks when cache invalidation is needed.

When Ghost updates content, it includes an `X-Cache-Invalidate` header in its responses to indicate which content needs cache invalidation. This proxy captures that header and forwards the information to a configurable webhook endpoint, allowing integration with any cache service or CDN.

## Project History

This project evolved from [ghost-bunnycdn-perma-cache-purger](https://github.com/magicpages/ghost-bunnycdn-perma-cache-purger), which was specifically designed to work with BunnyCDN. While the original project served its purpose well, this version has been abstracted to work with any webhook-capable CDN or cache system, making it more versatile for different hosting setups. The core functionality of monitoring Ghost's X-Cache-Invalidate headers remains the same, but the cache purging mechanism has been generalized to support configurable webhooks.

## Usage

The `magicpages/ghost-cache-invalidation-proxy` Docker image is available on [Docker Hub](https://hub.docker.com/r/magicpages/ghost-cache-invalidation-proxy). It can be used to deploy the proxy as part of a Docker Compose stack alongside Ghost.

### Environment Variables

#### Required variables

- `GHOST_URL`: The URL of your Ghost CMS instance. Ideally, the hostname of your Ghost container and the port it listens on (e.g., `http://ghost:2368`).
- `WEBHOOK_URL`: The URL of the webhook endpoint to call when cache invalidation is needed.

#### Optional variables

- `PORT`: The port on which the proxy listens for incoming requests. Defaults to `3000`.
- `DEBUG`: Set to `true` to enable debug logging. Defaults to `false`.
- `WEBHOOK_METHOD`: HTTP method to use for the webhook call. Defaults to `POST`.
- `WEBHOOK_SECRET`: Secret key for webhook authentication. Will be used in the Authorization header if provided.
- `WEBHOOK_HEADERS`: JSON string of additional headers to include in the webhook request.
- `WEBHOOK_BODY_TEMPLATE`: JSON template for the webhook request body. Supports the following variables:
  - `${urls}`: Array of URLs/patterns from the `X-Cache-Invalidate` header.
  - `${purgeAll}`: Boolean indicating if all cache should be purged.
  - `${timestamp}`: Current timestamp.
  - `${pattern}`: Raw pattern from the `X-Cache-Invalidate` header.
- `WEBHOOK_RETRY_COUNT`: Number of retry attempts for failed webhook calls. Defaults to `3`.
- `WEBHOOK_RETRY_DELAY`: Delay in milliseconds between retry attempts. Defaults to `1000`.

### Example Docker Compose Configuration

```yaml
version: '3.8'

services:
  ghost:
    image: ghost:5
    environment:
      url: http://localhost:4000
      database__client: sqlite3
      database__connection__filename: /var/lib/ghost/content/data/ghost.db
    volumes:
      - ghost_data:/var/lib/ghost/content

  cache-invalidation:
    image: magicpages/ghost-cache-invalidation-proxy:latest
    environment:
      - GHOST_URL=http://ghost:2368
      - PORT=4000
      - DEBUG=true
      - WEBHOOK_URL=https://api.example.com/invalidate
      - WEBHOOK_METHOD=POST
      - WEBHOOK_SECRET=your_secret_key
      - WEBHOOK_HEADERS={"Custom-Header": "Value"}
      - WEBHOOK_BODY_TEMPLATE={"urls": ${urls}, "timestamp": "${timestamp}", "purgeAll": ${purgeAll}}
    ports:
      - "4000:4000"
    depends_on:
      - ghost

volumes:
  ghost_data:
```

## Integration Examples

### BunnyCDN Integration

To use this with BunnyCDN, set up your webhook configuration like this:

```
WEBHOOK_URL=https://api.bunny.net/purge
WEBHOOK_METHOD=POST
WEBHOOK_SECRET=your_bunnycdn_api_key
WEBHOOK_HEADERS={"AccessKey": "${secret}", "Content-Type": "application/json"}
WEBHOOK_BODY_TEMPLATE={"urls": ${urls}}
```

### Cloudflare Integration

For Cloudflare:

```
WEBHOOK_URL=https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache
WEBHOOK_METHOD=POST
WEBHOOK_SECRET=your_cloudflare_api_token
WEBHOOK_HEADERS={"Authorization": "Bearer ${secret}", "Content-Type": "application/json"}
WEBHOOK_BODY_TEMPLATE={"files": ${urls}}
```

**Note**: Cloudflare has limits on how many URLs you can purge in a single API call:
- Free/Pro/Business plans: Maximum of 30 URLs per request
- Enterprise plans: Maximum of 500 URLs per request

If your Ghost updates might generate more URLs than these limits, consider implementing additional logic to batch requests (e.g. building your own webhook endpoint that batches requests).

## How It Works

1. The proxy forwards all client requests to the Ghost CMS instance.
2. When Ghost responds, the proxy checks for the `X-Cache-Invalidate` header.
3. If the header is present, the proxy extracts the invalidation patterns and constructs a webhook payload.
4. The webhook is called with the configured parameters, headers, and body.
5. The proxy supports retries for failed webhook calls.

## License

This project is licensed under the MIT License.

## Contributing

If you have any ideas for improvements or new features, feel free to open an issue or submit a pull request. 