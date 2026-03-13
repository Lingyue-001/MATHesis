# Debug Query Flags

This file is auto-generated from `src/js/debugFlags.mjs`. Do not edit manually.

## Supported Flags

| Flag | Type | Values | Default | Scope | Description |
| --- | --- | --- | --- | --- | --- |
| `ctextDebug` | boolean | `0`, `1` | `false` | CText lookup UI | Show CText debug details (source mode and per-variant debug block). |
| `ctextRefresh` | boolean | `0`, `1` | `false` | CText middleware | Bypass middleware cache for this request. |
| `ctextSource` | enum | `auto`, `cache`, `json`, `middleware` | `auto` | CText data source selector | Force CText request source; auto uses middleware on localhost and static cache elsewhere. |
| `ctextProxyOrigin` | string |  | `` | CText middleware endpoint | Optional absolute proxy origin override, e.g. https://ctext-proxy.example.com |

## Examples

- `?ctextDebug=1`
- `?ctextDebug=1&ctextSource=json`
- `?ctextDebug=1&ctextRefresh=1&ctextSource=middleware`
