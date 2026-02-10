import { collectNodeDisplayRows, buildUnifiedEntryName } from "./nodeEntrySchema.js";

const baseUrl = document.documentElement.dataset.baseurl || "/";
const withBase = (path) => `${baseUrl.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`;

// 全局变量：映射表初始化为空
let simpToTradMap = {};

fetch(withBase("simp_to_trad_map.json"))
  .then(res => res.json())
  .then(data => {
    simpToTradMap = data;
    console.log("✅ 简繁映射加载完成", Object.keys(simpToTradMap).length, "项");
  })
  .catch(err => {
    console.error("❌ 加载 simp_to_trad_map.json 失败：", err);
  });

document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch(withBase("data.json"));
  const data = await response.json();
  const nodes = data.nodes;
  const relationships = data.edges || [];

  const searchInput = document.getElementById("searchInput");
  const fieldTypeCheckboxes = document.querySelectorAll(".field-type");
  const categorySelect = document.getElementById("categorySelect");
  const relationSelect = document.getElementById("relationSelect");
  const resultsContainer = document.getElementById("results");

  const idToNodeMap = {};
  nodes.forEach(n => { idToNodeMap[n.id] = n });

  const DEFAULT_FIELDS = [
    "name", "name_en", "name_zh", "name_zh_simple", "name_pinyin", "name_sa", "nodes", "transliteration",
    "meaning_en", "meaning_zh", "meaning_zh_simple", "meaning_sa", "meaning_tr",
    "symbolic_meaning_en", "explanation", "value", "note",
    "related_concepts", "related_concepts_simple",
    "cullen_source", "cullen_quote_en", "petrocchi_source", "petrocchi_quote_en", "source",
    "system", "system_tags", "system_tags_zh", "system_tags_zh_simple", "style", "label",
    "original_text_en", "original_text_zh", "original_text_sa", "original_text_tr",
    "traditional_term_en", "traditional_term_zh", "traditional_term_zh_simple", "traditional_term_pinyin",
    "cardURL", "visualisation", "relationships", "id"
  ];

  function convertSimpToTrad(str, mapping) {
    return str.split("").map(char => mapping[char] || char).join("");
  }

  function highlight(text, keyword, mapping = {}) {
    if (!keyword || !text) return text;
    const variants = [keyword, convertSimpToTrad(keyword, mapping)];
    let highlighted = text;
    variants.forEach(variant => {
      if (!variant) return;
      const re = new RegExp(variant, 'g');
      highlighted = highlighted.replace(re, `<mark>${variant}</mark>`);
    });
    return highlighted;
  }

  function getSelectedFields() {
    const checked = Array.from(fieldTypeCheckboxes).filter(cb => cb.checked);
    const types = checked.map(cb => cb.value);
    let fields = [];

    if (types.includes("entry")) {
      fields.push("name", "name_zh", "name_en", "transliteration", "name_sa", "name_pinyin", "name_zh_simple", "nodes");
    }
    if (types.includes("meaning")) {
      fields.push("meaning_zh", "meaning_zh_simple", "meaning_en", "meaning_tr", "meaning_sa", "symbolic_meaning_en", "explanation", "related_concepts", "related_concepts_simple", "note", "value");
    }
    if (types.includes("system")) {
      fields.push("system", "system_tags", "style");
    }
    if (types.includes("source")) {
      fields.push("source", "cullen_source", "petrocchi_source");
    }
    if (types.includes("related")) {
      fields.push("related"); // 占位用，不参与属性字段搜索，只标识启用关系搜索
    }

    return fields.length === 0 ? [...DEFAULT_FIELDS, "related"] : [...new Set(fields)];
  }

  function getBestName(properties) {
    return properties.name_zh || properties.name || properties.name_en || properties.transliteration || properties.name_sa || "[Unnamed Node]";
  }

  function formatRelationType(type, keyword = "") {
    const label = type.replace(/_/g, " ").toLowerCase();
    if (!keyword) return `<span class="relation-highlight">${label}</span>`;
    const re = new RegExp(`(${keyword})`, "gi");
    return `<span class="relation-highlight">${label.replace(re, `<mark>$1</mark>`)}</span>`;
  }

  function render(results, keyword, fields, selectedRelation = "All") {
    // ✅ 先清空旧内容（解决重复卡片问题）
    resultsContainer.innerHTML = "";
    const countBox = document.getElementById("resultCount");
    if (countBox) countBox.innerHTML = "";
  
    // ✅ 若无结果，则显示友好提示 & 返回（不渲染卡片）
    if (!Array.isArray(results) || results.length === 0) {
      if (countBox) {
        countBox.innerHTML = `<style="color: #b08b4f;"> (·ω·) No treasures found this time... try a different charm?</style>`;
      }
      return;
    }
  
    // ✅ 有结果时显示数量
    if (countBox) {
      countBox.innerHTML = `<strong>${results.length}</strong> result${results.length !== 1 ? "s" : ""} found.`;
    }

    results.forEach(item => {
      const div = document.createElement("div");
      div.className = "result-card";

      const label = item.labels?.[0]?.toLowerCase();
      let labelPrefix = "Symbol";
      let titleZh = "", titleEn = "";

      if (label === "number") {
        labelPrefix = "Number";
        titleZh = highlight(item.properties?.value?.toString() || item.properties?.name || "", keyword, simpToTradMap);
      } else if (label === "sanskritsymbol") {
        const unifiedName = buildUnifiedEntryName(item.properties || {});
        titleZh = highlight(unifiedName, keyword, simpToTradMap);
      } else {
        const unifiedName = buildUnifiedEntryName(item.properties || {});
        titleZh = highlight(unifiedName, keyword, simpToTradMap);
      }

      let html = `<div class='node-content'><h3 class='result-title'>${labelPrefix}: ${titleZh} ${titleEn}</h3><hr class="result-divider" />`;
      let mainContent = "", quoteContent = "";

      const rows = collectNodeDisplayRows(item.properties, {
        skipNumberValue: label === "number",
        excludeKeys: new Set(["name_sa", "transliteration", "name_zh", "name_en"])
      });
      rows.forEach((row) => {
        const shouldHighlight = fields.includes(row.key);
        const content = shouldHighlight
          ? highlight(row.value, keyword, simpToTradMap)
          : row.value;
        const lineHtml = `<div class="result-section"><strong>${row.label}:</strong> ${row.isReference ? `<em>${content}</em>` : content}</div>`;
        if (row.isReference || row.isPrimaryText) quoteContent += lineHtml;
        else mainContent += lineHtml;
      });
      

      html += mainContent;

      if (quoteContent) {
        html += `<div class="quote-box" style="margin-top: 2.5rem;"><div class="quote-title"><em>QUOTE & SOURCE</em></div>${quoteContent}</div>`;
      }

      const incoming = relationships.filter(r => r.target === item.id && idToNodeMap[r.source] && (selectedRelation === "All" || r.type === selectedRelation)).map(r => {
        const fromNode = idToNodeMap[r.source];
        const name = getBestName(fromNode.properties || {});
        const highlightRelations = fields.includes("related");
const displayedName = highlightRelations ? highlight(name, keyword, simpToTradMap) : name;
        return `<li><button class='related-toggle' data-id='${r.source}'>${highlight(name, keyword, simpToTradMap)}</button> 👈 ${formatRelationType(r.type, keyword)} 👈 This Node<div class='related-details' id='details-${r.source}' style='display:none;'></div></li>`;
      });

      const outgoing = relationships.filter(r => r.source === item.id && idToNodeMap[r.target] && (selectedRelation === "All" || r.type === selectedRelation)).map(r => {
        const toNode = idToNodeMap[r.target];
        const name = getBestName(toNode.properties || {});
        return `<li>This Node 👉 ${formatRelationType(r.type, keyword)} 👉 <button class='related-toggle' data-id='${r.target}'>${highlight(name, keyword, simpToTradMap)}</button><div class='related-details' id='details-${r.target}' style='display:none;'></div></li>`;
      });

      if (incoming.length || outgoing.length) {
        html += `<div class='related-box' style="margin-top: 1.5rem;">
        <strong>Related Nodes:</strong><br>
        ${incoming.length ? `<div><strong>Incoming:</strong><ul>${incoming.join("")}</ul></div>` : ""}
        ${outgoing.length ? `<div><strong>Outgoing:</strong><ul>${outgoing.join("")}</ul></div>` : ""}
      </div>`;

      }      

      html += "</div>";
      div.innerHTML = html;
      resultsContainer.appendChild(div);
    });

    document.querySelectorAll(".related-toggle").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        const container = document.getElementById(`details-${id}`);
        const node = idToNodeMap[id];
        if (!node) return;
        if (container.innerHTML !== "") {
          container.style.display = container.style.display === "none" ? "block" : "none";
          return;
        }

        let innerHTML = "<div class='card subcard'>";
        const rows = collectNodeDisplayRows(node.properties, {
          excludeKeys: new Set(["name_sa", "transliteration", "name_zh", "name_en"])
        });
        rows.forEach((row) => {
          innerHTML += `<p><strong>${row.label}:</strong> ${highlight(row.value, searchInput.value, simpToTradMap)}</p>`;
        });
        innerHTML += "</div>";
        container.innerHTML = innerHTML;
        container.style.display = "block";
      });
    });
  }

  function search() {
    const keyword = searchInput.value.trim();
const selectedCategory = categorySelect?.value || "All";
const selectedRelation = relationSelect?.value || "All";

const rawFields = getSelectedFields();
const excludedFields = ["cullen_source", "petrocchi_source", "source"];
const fields = rawFields.filter(f => !excludedFields.includes(f));

// ✅ 新增逻辑：如果关键词为空，字段没勾选，分类和关系都是 All，则直接返回所有节点
const isBlankSearch = !keyword && rawFields.length === 0 && selectedCategory === "All" && selectedRelation === "All";
if (isBlankSearch) {
  render(nodes, "", DEFAULT_FIELDS, "All");
  return;
}

let filteredNodes = nodes.filter(n => {
  const label = (n.labels && n.labels[0])?.toLowerCase();
  return selectedCategory === "All" || label === selectedCategory.toLowerCase();
});


    let results = filteredNodes.filter(entry => {
  // 如果是 property 字段匹配
  const propertyMatch = fields.some(key =>
    key !== "related" &&
    entry.properties &&
    entry.properties[key] &&
    entry.properties[key].toString().toLowerCase().includes(keyword.toLowerCase())
  );

  // 如果勾选了 related，并且在任何一条关系的相关节点中 name 匹配
  const relatedMatch = fields.includes("related") &&
    relationships.some(r => {
      const isSource = r.source === entry.id;
      const isTarget = r.target === entry.id;
      const relatedNodeId = isSource ? r.target : isTarget ? r.source : null;
      const relatedNode = idToNodeMap[relatedNodeId];
      if (!relatedNode) return false;
      const name = getBestName(relatedNode.properties || {});
      return name.toLowerCase().includes(keyword.toLowerCase());
    });

  return propertyMatch || relatedMatch;
});

// ✅ 加入关键词优先排序逻辑
results.sort((a, b) => {
  const score = (entry) => {
    const props = entry.properties || {};
    if ((props.name || "").toLowerCase().includes(keyword.toLowerCase())) return 3;
    if ((props.value?.toString() || "").toLowerCase().includes(keyword.toLowerCase())) return 2;
    if ((props.note || "").toLowerCase().includes(keyword.toLowerCase())) return 1;
    return 0;
  };
  return score(b) - score(a);
});


    if (selectedRelation !== "All") {
      const relatedNodeIds = new Set();
      relationships.forEach(r => {
        if (r.type === selectedRelation) {
          relatedNodeIds.add(r.source);
          relatedNodeIds.add(r.target);
        }
      });
      const beforeCount = results.length;
      results = results.filter(node => relatedNodeIds.has(node.id));
      if (results.length === 0 && beforeCount > 0) {
        resultsContainer.innerHTML = `<p>No matching results found <br><em>(Some results matched the keyword, but not the selected relationship type.)</em></p>`;
        return;
      }
    }

    if (selectedCategory === "number") {
      results = results
        .filter(n => n.properties?.value !== undefined)
        .sort((a, b) => (parseFloat(a.properties.value) || 0) - (parseFloat(b.properties.value) || 0));
    }

    render(results, keyword, fields, selectedRelation);
  }

  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") search();
  });
  document.getElementById("searchBtn")?.addEventListener("click", search);
});
