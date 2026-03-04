export const DEBUG_FLAG_SPECS = [
  {
    key: "ctextDebug",
    type: "boolean",
    defaultValue: false,
    values: ["0", "1"],
    scope: "CText lookup UI",
    description: "Show CText debug details (source mode and per-variant debug block)."
  },
  {
    key: "ctextRefresh",
    type: "boolean",
    defaultValue: false,
    values: ["0", "1"],
    scope: "CText middleware",
    description: "Bypass middleware cache for this request."
  },
  {
    key: "ctextSource",
    type: "enum",
    defaultValue: "auto",
    values: ["auto", "json", "middleware"],
    scope: "CText data source selector",
    description: "Force CText request source; auto tries middleware first, then falls back to json."
  },
  {
    key: "ctextProxyOrigin",
    type: "string",
    defaultValue: "",
    values: [],
    scope: "CText middleware endpoint",
    description: "Optional absolute proxy origin override, e.g. https://ctext-proxy.example.com"
  }
];

export function parseBooleanFlag(value, defaultValue = false) {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return defaultValue;
}

export function getDebugFlagsFromSearch(search = "") {
  const params = new URLSearchParams(search || "");
  const ctextSourceRaw = String(params.get("ctextSource") || "").toLowerCase();
  const ctextSource = ["json", "middleware"].includes(ctextSourceRaw)
    ? ctextSourceRaw
    : "auto";
  const ctextProxyOriginRaw = String(params.get("ctextProxyOrigin") || "").trim();
  let ctextProxyOrigin = "";
  if (ctextProxyOriginRaw) {
    try {
      const parsed = new URL(ctextProxyOriginRaw);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        ctextProxyOrigin = parsed.origin;
      }
    } catch {
      ctextProxyOrigin = "";
    }
  }

  return {
    ctextDebug: parseBooleanFlag(params.get("ctextDebug"), false),
    ctextRefresh: parseBooleanFlag(params.get("ctextRefresh"), false),
    ctextSource,
    ctextProxyOrigin
  };
}

export function isLocalhost(hostname = "") {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function resolveCtextSourceMode(flags, hostname = "") {
  if (flags?.ctextSource === "json" || flags?.ctextSource === "middleware") {
    return flags.ctextSource;
  }
  return isLocalhost(hostname) ? "middleware" : "auto";
}
