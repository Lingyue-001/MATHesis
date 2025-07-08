import json
import opencc

print("🔍 当前脚本路径：", __file__)

# 加载简繁转换器
converter = opencc.OpenCC('s2t')
reverse_converter = opencc.OpenCC('t2s')

import os

base_path = os.path.dirname(__file__)  # 获取脚本所在目录
json_path = os.path.join(base_path, "src", "js", "data.json")

with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# 读取你的 JSON 文件路径
with open("/Users/lma/Downloads/eleventy-symbolic-math/src/data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# 收集所有节点中的字符
all_chars = set()
for node in data.get("nodes", []):
    for val in node.get("properties", {}).values():
        if isinstance(val, str):
            all_chars.update(val)

# 构建简体 → 繁体映射
mapping = {}
for char in all_chars:
    trad = converter.convert(char)
    simp = reverse_converter.convert(char)
    if simp != trad:
        mapping[simp] = trad

# 输出结果为 JSON 文件
with open("simp_to_trad_map.json", "w", encoding="utf-8") as f:
    json.dump(mapping, f, ensure_ascii=False, indent=2)

print("✔️ 已生成 simp_to_trad_map.json 映射文件")
