import argparse
import json
from pathlib import Path

import opencc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate simp->trad character map from project node data."
    )
    base_dir = Path(__file__).resolve().parent
    parser.add_argument(
        "--input",
        type=Path,
        default=base_dir / "src" / "data.json",
        help="Path to input JSON file (default: ./src/data.json)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=base_dir / "simp_to_trad_map.json",
        help="Path to output map file (default: ./simp_to_trad_map.json)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    output_path = args.output.resolve()

    converter = opencc.OpenCC("s2t")
    reverse_converter = opencc.OpenCC("t2s")

    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    all_chars = set()
    for node in data.get("nodes", []):
        for val in node.get("properties", {}).values():
            if isinstance(val, str):
                all_chars.update(val)

    mapping = {}
    for char in all_chars:
        trad = converter.convert(char)
        simp = reverse_converter.convert(char)
        if simp != trad:
            mapping[simp] = trad

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"Generated map: {output_path}")


if __name__ == "__main__":
    main()
