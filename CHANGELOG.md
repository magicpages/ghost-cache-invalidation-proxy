# Changelog

All notable changes to the Ghost Cache Invalidation Proxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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