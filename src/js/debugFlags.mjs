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
    description: "Force CText request source; auto chooses middleware on localhost and json on non-localhost."
  },
  {
    key: "ctextProxy",
    type: "string",
    defaultValue: "",
    values: ["<url>"],
    scope: "CText proxy endpoint",
    description: "Proxy base URL for JSON mode. Recommended: your Netlify site domain."
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

  return {
    ctextDebug: parseBooleanFlag(params.get("ctextDebug"), false),
    ctextRefresh: parseBooleanFlag(params.get("ctextRefresh"), false),
    ctextSource,
    ctextProxy: String(params.get("ctextProxy") || "").trim()
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
  return isLocalhost(hostname) ? "middleware" : "json";
}
