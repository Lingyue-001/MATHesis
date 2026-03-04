# Debug Query Flags

This file is auto-generated from `src/js/debugFlags.mjs`. Do not edit manually.

## Supported Flags

| Flag | Type | Values | Default | Scope | Description |
| --- | --- | --- | --- | --- | --- |
| `ctextDebug` | boolean | `0`, `1` | `false` | CText lookup UI | Show CText debug details (source mode and per-variant debug block). |
| `ctextRefresh` | boolean | `0`, `1` | `false` | CText middleware | Bypass middleware cache for this request. |
| `ctextSource` | enum | `auto`, `json`, `middleware` | `auto` | CText data source selector | Force CText request source; auto chooses middleware on localhost and json on non-localhost. |
| `ctextProxy` | string | `<url>` | `` | CText proxy endpoint | Optional proxy base URL for JSON mode. Example: `https://<your-worker-domain>`. |

## Examples

- `?ctextDebug=1`
- `?ctextDebug=1&ctextSource=json`
- `?ctextDebug=1&ctextRefresh=1&ctextSource=middleware`
- `?ctextSource=json&ctextProxy=https://<your-worker-domain>`

Note:
- In non-localhost environments, `ctextSource=json` requires `ctextProxy` to be provided; otherwise the request fails fast with an explicit error.
