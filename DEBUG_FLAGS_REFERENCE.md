# Debug Query Flags

This file is auto-generated from `src/js/debugFlags.mjs`. Do not edit manually.

## Supported Flags

| Flag | Type | Values | Default | Scope | Description |
| --- | --- | --- | --- | --- | --- |
| `ctextDebug` | boolean | `0`, `1` | `false` | CText lookup UI | Show CText debug details (source mode and per-variant debug block). |
| `ctextRefresh` | boolean | `0`, `1` | `false` | CText middleware | Bypass middleware cache for this request. |
| `ctextSource` | enum | `auto`, `json`, `middleware` | `auto` | CText data source selector | Force CText request source; auto defaults to middleware. |
| `ctextProxy` | string | `https://your-netlify-site.netlify.app` | `` | CText middleware proxy origin | Optional origin used when page host has no middleware endpoint (e.g., GitHub Pages). |

## Examples

- `?ctextDebug=1`
- `?ctextDebug=1&ctextSource=json`
- `?ctextDebug=1&ctextSource=middleware&ctextRefresh=1`
- `?ctextDebug=1&ctextSource=middleware&ctextProxy=https://mathesis.netlify.app`
