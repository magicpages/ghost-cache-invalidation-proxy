# Changelog

All notable changes to the Ghost Cache Invalidation Proxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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