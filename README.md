# Ghost Cache Invalidation Proxy

A lightweight proxy that captures Ghost CMS cache invalidation signals (`X-Cache-Invalidate` headers) and forwards them to configurable webhook endpoints.

## Why Use This?

Ghost provides webhook functionality, but it has limitations:

- Webhooks don't capture all types of content updates (without setting up multiple webhook types)
- The `site.changed` webhook only tells you *that* something changed, not *what* exactly
- Webhooks are stored in the database, creating persistent configuration that follows site migrations
- Managing webhooks across multiple sites becomes a maintenance burden

This proxy solves these issues by monitoring the `X-Cache-Invalidate` header that Ghost sends with all content updates, including theme changes, route modifications, and other site-wide changes.



## Usage
The `magicpages/ghost-cache-invalidation-proxy` Docker image is available on 
[Docker Hub](https://hub.docker.com/r/magicpages/ghost-cache-invalidation-proxy). It can be used to deploy the proxy as part of a Docker Compose stack alongside Ghost.

## How It Works

The proxy sits between your Ghost instance and the internet, monitoring traffic for the `X-Cache-Invalidate` header. When it detects this header, it extracts the invalidation patterns and forwards them to your configured webhook endpoints.

This approach is particularly valuable for:
- Managed hosting providers
- Organizations running multiple Ghost sites
- Anyone wanting precise cache invalidation without webhook management overhead

## Installation

### Using Docker (recommended)

```
docker pull magicpages/ghost-cache-invalidation-proxy:latest
```

### Docker Compose Example

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
      - WEBHOOK_URL=https://api.example.com/invalidate
      - WEBHOOK_METHOD=POST
      - WEBHOOK_SECRET=your_secret_key
      - WEBHOOK_HEADERS={"Custom-Header": "Value", "Authorization": "Bearer ${secret}"}
      - WEBHOOK_BODY_TEMPLATE={"urls": ${urls}, "timestamp": "${timestamp}", "purgeAll": ${purgeAll}}
    ports:
      - "4000:4000"
    depends_on:
      - ghost

volumes:
  ghost_data:
```

See the [Complete Example](docker-compose.example.yml) for a full setup including MySQL and required reverse proxy configuration.

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `GHOST_URL` | URL of your Ghost instance | Required |
| `PORT` | Port to run the proxy on | `4000` |
| `DEBUG` | Enable debug logging | `false` |
| `WEBHOOK_URL` | URL to forward invalidation events to | Required |
| `WEBHOOK_METHOD` | HTTP method for the webhook | `POST` |
| `WEBHOOK_SECRET` | Secret to include in webhook requests | `""` |
| `WEBHOOK_HEADERS` | JSON object of headers to include | `{}` |
| `WEBHOOK_BODY_TEMPLATE` | Template for the webhook body | `{"urls": ${urls}}` |
| `WEBHOOK_RETRY_COUNT` | Number of retry attempts for failed webhook calls | `3` |
| `WEBHOOK_RETRY_DELAY` | Delay between retries in milliseconds | `1000` |

### Template Variables

These variables can be used in both header values and the body template:

- `${urls}`: Array of URLs to invalidate
- `${timestamp}`: Current timestamp
- `${purgeAll}`: Boolean indicating if all content should be purged
- `${secret}`: The value of `WEBHOOK_SECRET`

## CDN Examples

### Bunny.net

```
WEBHOOK_URL=https://api.bunny.net/purge
WEBHOOK_METHOD=POST
WEBHOOK_SECRET=your_bunny_api_key
WEBHOOK_HEADERS={"AccessKey": "${secret}", "Content-Type": "application/json"}
WEBHOOK_BODY_TEMPLATE={"urls": ${urls}}
```

### Cloudflare

```
WEBHOOK_URL=https://api.cloudflare.com/client/v4/zones/your_zone_id/purge_cache
WEBHOOK_METHOD=POST
WEBHOOK_SECRET=your_cloudflare_api_token
WEBHOOK_HEADERS={"Authorization": "Bearer ${secret}", "Content-Type": "application/json"}
WEBHOOK_BODY_TEMPLATE={"files": ${urls}}
```



## License

This project is licensed under the MIT License.

## Contributing

If you have any ideas for improvements or new features, feel free to open an 
issue or submit a pull request.