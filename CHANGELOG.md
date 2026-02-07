# Changelog

All notable changes to the Ghost Cache Invalidation Proxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Deprecated] - 2026-02-07

### Deprecated
- This project is deprecated and no longer maintained
- Magic Pages has migrated all CDN infrastructure to Cloudflare, which provides native cache invalidation through Cloudflare Workers at the edge
- No further updates, bug fixes, or security patches will be released
- The repository is archived for reference only

## [1.3.3] - 2026-01-23

### Added
- Request timeouts to prevent indefinite hangs when upstream is slow or unresponsive
  - `PROXY_TIMEOUT` (default 30s): Controls connection, headers, and body timeouts for Ghost requests
  - `WEBHOOK_TIMEOUT` (default 30s): Controls timeout for webhook HTTP requests with AbortController
- Cache invalidation pattern accumulation during debounce window
  - Previously only the last pattern was sent; now all patterns are collected and sent together

### Fixed
- Webhook requests no longer hang indefinitely on slow or unresponsive endpoints
- Cache invalidation no longer loses patterns when multiple invalidations occur within the debounce window

### Changed
- Default `PROXY_TIMEOUT` reduced from 600s to 30s for faster failure detection

## [1.3.2] - 2026-01-13

### Changed
- Updated Docker image to Node.js 24 LTS for undici v7 compatibility

## [1.3.1] - 2026-01-13

### Fixed
- Fixed DNS caching issue causing connection failures when backend IP changes
- Added `cacheable-lookup` for TTL-aware DNS caching (max 60s)
- DNS cache is now automatically cleared on connection errors for immediate recovery

## [1.3.0] - 2025-11-21

### Changed
- Replaced `http-proxy` with `fast-proxy` + `undici` for significantly improved performance
- Proxy overhead reduced from 120-286ms to near-zero
- Added connection pooling (100 connections) and HTTP pipelining (10 requests deep)
- Added URL caching for parsed URLs (1000 entries)

### Removed
- Removed `http-proxy` and related type dependencies

## [1.1.0] - 2025-09-29

### Added
- Configuration option for timeout

## [1.0.0] - 2025-03-11

### Added
- Initial release of the Ghost Cache Invalidation Proxy
- Evolved from ghost-bunnycdn-perma-cache-purger to be more versatile and CDN-agnostic
- Proxy functionality to forward requests to Ghost CMS
- Webhook configuration via environment variables
- Template support for webhook request bodies
- Retry mechanism for failed webhook calls
- Integration examples for popular CDN providers
- Abstracted cache invalidation to work with any webhook-capable CDN or cache system 