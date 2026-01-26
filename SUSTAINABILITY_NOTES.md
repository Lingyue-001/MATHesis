# Sustainability Notes

This file tracks current redundancies, conflicts, and clarity gaps that affect long-term maintainability.

## Data consistency risks
- Multiple data sources for graph content: `src/data.json` (search/data pages) vs `static/*.csv` (visualization). This can drift without a declared source of truth.
- Duplicate edge entry in `src/data.json` for `source: 18 -> target: 4 -> type: PRODUCES`.

## Script and workflow issues
- `generate_simp_trad_map.py` reads a hardcoded absolute path and also references `src/js/data.json` which does not exist, making it non-portable and easy to run against the wrong file.

## Code hygiene
- `src/js/filter.js` defines `displayedName` but does not use it.

## Missing documentation
- No single place describes the canonical data source, update workflow, or the relationship between JSON and CSV artifacts.

## New request: automated export (Python)
- Requirement: replace manual Neo4j export with an automated Python script.
- Expected mode (agreed): keep current Eleventy structure; use a script to export from Neo4j to `src/data.json` and `static/*.csv`, and run it before `start/build`.
