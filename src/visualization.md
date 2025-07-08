---
title: MATHesis – Visualization
layout: base.liquid
---

<div id="graph-container" style="height: 600px; border: 1px solid #ccc; margin: 3rem auto;"></div>

<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<script>
async function drawGraph() {
  // 加载 CSV 数据
  const nodeCsv = await fetch("/static/node-export.csv").then(res => res.text());
  const edgeCsv = await fetch("/static/relationship-export.csv").then(res => res.text());

  // 解析 CSV 并清洗字段名为统一格式
  const parseCSV = (text) => {
    const [headerLine, ...lines] = text.trim().split("\n");
    const headers = headerLine
      .split(",")
      .map(h => h.trim().replace(/^"|"$/g, ""));

    const normalizeKeys = (row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().replace(/\s+/g, "_"), v])
      );

    return lines.map(line => {
      const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row = Object.fromEntries(values.map((v, i) => [headers[i], v]));
      return normalizeKeys(row);
    });
  };

  const rawNodes = parseCSV(nodeCsv);
  const rawEdges = parseCSV(edgeCsv);

  console.log("✅ rawNodes sample:", rawNodes.slice(0, 2));
  console.log("✅ rawEdges sample:", rawEdges.slice(0, 2));

  // 创建节点数据
  const nodes = new vis.DataSet(
    rawNodes.map(n => {
      const zh = n["name_zh"]?.trim();
      const sa = n["name_sa"]?.trim();
      const val = n["value"]?.trim();
      const en = n["name_en"]?.trim();

      // 拼接 label：中文优先，其次梵文或值，英文在后缀
      let label = "";
      if (zh || sa || val) {
        label = `${zh || sa || val}${en ? " / " + en : ""}`;
      } else if (en) {
        label = en;
      } else {
        label = "Unnamed";
      }

      const title = n["note"]?.trim() || label;

      return {
        id: n["~id"],
        label,
        title,
        color: n["~labels"] === "Number" ? "#3a7bd5" : "#e86e6e",
        font: { face: "Georgia" }
      };
    })
  );

  // 创建边数据
  const edges = new vis.DataSet(
    rawEdges.map(e => ({
      from: e["~start_node_id"],
      to: e["~end_node_id"],
      arrows: "to",
      label: e["~relationship_type"] || "",
      font: { align: 'middle', face: "Georgia", ital: true },
      color: { color: "#bbb", highlight: "#444" }
    }))
  );

  // 渲染图
  const container = document.getElementById("graph-container");
  const data = { nodes, edges };
  const options = {
    layout: { improvedLayout: true },
    nodes: {
      shape: "dot",
      size: 18
    },
    edges: {
      smooth: true
    },
    physics: {
      enabled: true,
      stabilization: { iterations: 200 }
    }
  };

  new vis.Network(container, data, options);
}

drawGraph();
</script>
