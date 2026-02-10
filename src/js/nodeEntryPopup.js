import { collectNodeDisplayRows, buildUnifiedEntryName } from "./nodeEntrySchema.js";

const DEFAULT_EXCLUDE_KEYS = new Set(["name_sa", "transliteration", "name_zh", "name_en"]);
const PANEL_STYLE_ID = "node-entry-popup-style";

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function injectPopupStyle() {
  if (document.getElementById(PANEL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PANEL_STYLE_ID;
  style.textContent = `
    .node-entry-panel {
      position: fixed;
      right: 1rem;
      top: 5.2rem;
      width: clamp(300px, 26vw, 620px);
      max-height: min(74vh, 780px);
      z-index: 2600;
      background: #f7f2e8;
      border: 1px solid rgba(74, 62, 48, 0.24);
      border-radius: 14px;
      box-shadow: 0 14px 32px rgba(39, 30, 20, 0.24);
      overflow: hidden;
      opacity: 0;
      --panel-enter-x: 110%;
      transform: translateX(var(--panel-enter-x));
      pointer-events: none;
      transition: transform 0.25s ease, opacity 0.2s ease;
    }
    .node-entry-panel.side-left {
      --panel-enter-x: -110%;
    }
    .node-entry-panel.side-right {
      --panel-enter-x: 110%;
    }
    .node-entry-panel.is-open {
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }
    .node-entry-panel.is-dragging {
      transition: none;
      user-select: none;
    }
    .node-entry-panel.is-resizing {
      transition: none;
      user-select: none;
    }
    .node-entry-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.56rem 0.72rem;
      border-bottom: 1px solid rgba(74, 62, 48, 0.18);
      background: rgba(239, 229, 213, 0.86);
      cursor: move;
    }
    .node-entry-title {
      font-size: 0.95rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 700;
      color: #4f3f2d;
    }
    .node-entry-close {
      border: none;
      background: transparent;
      color: #5f4f3c;
      font-size: 1.18rem;
      line-height: 1;
      cursor: pointer;
      padding: 0.1rem 0.35rem;
    }
    .node-entry-body {
      max-height: min(62vh, 680px);
      overflow: auto;
      padding: 0.72rem 0.84rem 0.88rem;
    }
    .node-entry-resize-handle {
      position: absolute;
      top: 0.65rem;
      bottom: 0.65rem;
      width: 12px;
      z-index: 4;
      cursor: ew-resize;
      border-radius: 6px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .node-entry-panel:hover .node-entry-resize-handle {
      opacity: 1;
    }
    .node-entry-panel.side-left .node-entry-resize-handle {
      right: -6px;
      background: linear-gradient(90deg, rgba(74, 62, 48, 0.05), rgba(74, 62, 48, 0.2));
    }
    .node-entry-panel.side-right .node-entry-resize-handle {
      left: -6px;
      background: linear-gradient(270deg, rgba(74, 62, 48, 0.05), rgba(74, 62, 48, 0.2));
    }
    .node-entry-empty {
      margin: 0;
      color: #6c5a46;
      font-size: 0.92rem;
    }
    .node-entry-badge {
      font-size: 0.82rem;
      color: #6a5742;
      margin: 0 0 0.5rem;
    }
    .node-entry-badge code {
      font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      background: rgba(118, 90, 47, 0.1);
      padding: 0.08rem 0.26rem;
      border-radius: 4px;
      color: #5d431e;
      font-size: 0.82rem;
    }
    .node-entry-card {
      background: #fffdfa;
      border-radius: 10px;
      border: 1px solid rgba(74, 62, 48, 0.13);
      padding: 0.68rem 0.74rem;
    }
    .node-entry-card h3 {
      margin: 0 0 0.56rem;
      font-size: 1rem;
      color: #3c2f22;
    }
    .node-entry-row {
      margin: 0.36rem 0;
      color: #4f402f;
      font-size: 0.9rem;
      line-height: 1.46;
    }
    .node-entry-row strong {
      color: #3c2f22;
    }
  `;
  document.head.appendChild(style);
}

function makePanelDraggable(panel) {
  const handle = panel.querySelector(".node-entry-head");
  if (!(handle instanceof HTMLElement)) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMove = (event) => {
    if (!dragging) return;
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    const nextX = clamp(event.clientX - offsetX, margin, window.innerWidth - rect.width - margin);
    const nextY = clamp(event.clientY - offsetY, margin, window.innerHeight - rect.height - margin);
    panel.style.left = `${nextX}px`;
    panel.style.top = `${nextY}px`;
    panel.style.right = "auto";
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", stop);
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(".node-entry-close")) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    dragging = true;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    panel.classList.add("is-dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
  });
}

function makePanelResizable(panel) {
  const handle = panel.querySelector(".node-entry-resize-handle");
  if (!(handle instanceof HTMLElement)) return;
  if (panel.dataset.resizeBound === "1") return;
  panel.dataset.resizeBound = "1";

  let resizing = false;
  let startX = 0;
  let startWidth = 0;

  const onMove = (event) => {
    if (!resizing) return;
    const side = panel.classList.contains("side-left") ? "left" : "right";
    const dx = event.clientX - startX;
    const nextWidth = side === "left" ? startWidth + dx : startWidth - dx;
    const clampedWidth = clamp(nextWidth, 260, Math.max(260, window.innerWidth * 0.46));
    panel.style.width = `${clampedWidth}px`;
  };

  const stop = () => {
    if (!resizing) return;
    resizing = false;
    panel.classList.remove("is-resizing");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", stop);
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resizing = true;
    startX = event.clientX;
    startWidth = panel.getBoundingClientRect().width;
    panel.classList.add("is-resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
  });
}

function openPanelWithEnterAnimation(panel) {
  if (!(panel instanceof HTMLElement)) return;
  if (panel.classList.contains("is-open")) return;
  requestAnimationFrame(() => {
    panel.classList.add("is-open");
  });
}

function ensurePopupPanel(options) {
  injectPopupStyle();
  const {
    panelId = "nodeEntryPanel",
    panelTitle = "Node Details",
    emptyText = "Click a highlighted matched node to view details.",
    panelPosition = null
  } = options || {};

  let panel = document.getElementById(panelId);
  if (panel) return panel;

  panel = document.createElement("aside");
  panel.id = panelId;
  panel.className = "node-entry-panel";
  const side = panelPosition && typeof panelPosition === "object" && Object.prototype.hasOwnProperty.call(panelPosition, "left")
    ? "side-left"
    : "side-right";
  panel.classList.add(side);
  panel.innerHTML = `
    <div class="node-entry-head">
      <div class="node-entry-title">${escapeHtml(panelTitle)}</div>
      <button class="node-entry-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="node-entry-body">
      <p class="node-entry-empty">${escapeHtml(emptyText)}</p>
    </div>
    <div class="node-entry-resize-handle" aria-hidden="true"></div>
  `;
  document.body.appendChild(panel);
  if (panelPosition && typeof panelPosition === "object") {
    if (Object.prototype.hasOwnProperty.call(panelPosition, "left")) {
      panel.style.left = panelPosition.left;
      panel.style.right = "auto";
    }
    if (Object.prototype.hasOwnProperty.call(panelPosition, "right")) {
      panel.style.right = panelPosition.right;
    }
    if (Object.prototype.hasOwnProperty.call(panelPosition, "top")) {
      panel.style.top = panelPosition.top;
    }
    if (Object.prototype.hasOwnProperty.call(panelPosition, "bottom")) {
      panel.style.bottom = panelPosition.bottom;
    }
  }
  panel.querySelector(".node-entry-close")?.addEventListener("click", () => {
    panel.classList.remove("is-open");
  });
  makePanelDraggable(panel);
  makePanelResizable(panel);
  return panel;
}

function renderPanelContent(panel, node, clickedForm, options = {}) {
  const body = panel.querySelector(".node-entry-body");
  if (!body) return;
  const properties = node?.properties || {};
  const rows = collectNodeDisplayRows(properties, {
    excludeKeys: options.excludeKeys || DEFAULT_EXCLUDE_KEYS,
    valueFilter: options.valueFilter || null
  });
  const rowsHtml = rows
    .map((row) => `<div class="node-entry-row"><strong>${escapeHtml(row.label)}:</strong> ${row.isReference ? `<em>${escapeHtml(row.value)}</em>` : escapeHtml(row.value)}</div>`)
    .join("");

  body.innerHTML = `
    <div class="node-entry-badge">Matched form: <code>${escapeHtml(clickedForm || "(unknown)")}</code></div>
    <div class="node-entry-card">
      <h3>${escapeHtml(buildUnifiedEntryName(properties))}</h3>
      ${rowsHtml || "<p><em>No fields available.</em></p>"}
    </div>
  `;
}

export function bindNodeHitPopup(options = {}) {
  const {
    root,
    hitSelector = ".tei-node-hit",
    resolveNode,
    getMatchedText = ({ hit }) => (hit?.textContent || "").trim(),
    panelId = "nodeEntryPanel",
    panelTitle = "Node Details",
    emptyText = "Click a highlighted matched node to view details.",
    panelPosition = null,
    excludeKeys = DEFAULT_EXCLUDE_KEYS,
    valueFilter = null,
    stopPropagation = false,
    deferSingleClickMs = 0
  } = options;

  if (!(root instanceof Element)) return;
  if (typeof resolveNode !== "function") return;

  const bindKey = `nodePopupBound_${panelId}`;
  if (root.dataset[bindKey] === "1") return;
  root.dataset[bindKey] = "1";

  const activate = async (hit, event) => {
    const term = getMatchedText({ hit, event });
    try {
      const node = await resolveNode({ hit, term, event });
      if (!node) return;
      const panel = ensurePopupPanel({ panelId, panelTitle, emptyText, panelPosition });
      renderPanelContent(panel, node, term, { excludeKeys, valueFilter });
      openPanelWithEnterAnimation(panel);
    } catch (err) {
      console.warn("[Node popup] failed:", err);
    }
  };

  let pendingClickTimer = null;
  root.addEventListener("click", (event) => {
    const hit = event.target?.closest?.(hitSelector);
    if (!hit || !root.contains(hit)) return;
    if (stopPropagation) event.stopPropagation();

    if (deferSingleClickMs > 0) {
      if (pendingClickTimer) {
        window.clearTimeout(pendingClickTimer);
      }
      pendingClickTimer = window.setTimeout(() => {
        pendingClickTimer = null;
        activate(hit, event);
      }, deferSingleClickMs);
      return;
    }

    activate(hit, event);
  });

  if (deferSingleClickMs > 0) {
    root.addEventListener("dblclick", (event) => {
      const hit = event.target?.closest?.(hitSelector);
      if (!hit || !root.contains(hit)) return;
      if (pendingClickTimer) {
        window.clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
      }
    });
  }
}

export function resolveNodeByTerm(nodes, term, options = {}) {
  const list = Array.isArray(nodes) ? nodes : [];
  const fields = Array.isArray(options.fields) && options.fields.length
    ? options.fields
    : ["name", "name_zh", "name_zh_simple", "name_en", "name_sa", "transliteration", "original_text_tr", "original_text_zh"];
  const normalizer = typeof options.normalizer === "function"
    ? options.normalizer
    : (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

  const target = normalizer(term);
  if (!target) return null;

  let best = null;
  let bestScore = -1;

  for (const node of list) {
    const p = node?.properties || {};
    let score = 0;
    for (const key of fields) {
      const value = normalizer(p[key]);
      if (!value) continue;
      if (value === target) score += 10;
      else if (value.includes(target)) score += 4;
      else if (target.includes(value) && value.length >= 2) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }

  return bestScore > 0 ? best : null;
}
