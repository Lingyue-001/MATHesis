document.addEventListener("DOMContentLoaded", async () => {
    const baseUrl = document.documentElement.dataset.baseurl || "/";
    const withBase = (path) => `${baseUrl.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`;
    const response = await fetch(withBase("data.json")); // 🔁 和搜索页一样
    const data = await response.json();
    const nodes = data.nodes || [];
  
    const container = document.getElementById("dataset-container");
  
    nodes.forEach(node => {
      const label = (node.labels && node.labels[0])?.toLowerCase();
      let cardClass = "";
  
      if (label === "number") cardClass = "number-card";
      else if (label === "sanskritsymbol") cardClass = "sanskrit-card";
      else cardClass = "chinese-card";
  
      const zh = node.properties?.name_zh || "";
      const sa = node.properties?.name_sa || "";
      const en = node.properties?.name_en || node.properties?.name || "";
      const val = node.properties?.value || "";
  
      const div = document.createElement("div");
      div.className = `dataset-card ${cardClass}`;
  
      div.innerHTML = `
        <h3 class="dataset-title">${label === 'number' ? `Number: ${val}` : `${zh} ${sa} ${en}`}</h3>
        <p>${node.properties?.symbolic_meaning_en || node.properties?.explanation || ''}</p>
      `;
  
      container.appendChild(div);
    });
  });
  
  
