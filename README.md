# eleventy-symbolic-math

A research website built with Eleventy to explore symbolic math, calendrical systems, and cross-tradition textual relationships via graph data.

## Current scope (existing branch)
- Goal: Build a searchable site from a Neo4j node-edge database.
- Focus: Relations between numbers, mathematical operations, and symbolic/cosmological systems in early Chinese astronomical texts.
- Visualization intent: Make the scientific/algorithmic system and the philosophical/symbolic system visible side-by-side, including how a single number aggregates multiple symbolic contexts.
- Long-term intent: Expand to multiple texts and traditions to reveal patterns missed by classical philology alone.

## Planned scope (new branch)
- Goal: A Sanskrit manuscript visualization platform with scans, transcription, and translation.
- Interaction: Align transcription/translation to the manuscript image; reflect materiality of the manuscript in the UI.
- Search: Flexible matching (stems, inflectional variants, sandhi, compound subparts) and collection building (e.g., all occurrences of a word).
- OCR tool integration: Use an existing tool for segmentation + recognition; implement post-correction from the author’s paper and integrate into a user-friendly workflow.

## Project notes
- For current status and prioritized todos, see `NOTE_当前需求清单和待办_Current_Status_and_Todo.md`.
- For completed changes and retrospectives, see `LOG_已完成改动和复盘_Completed_Changes_and_Retrospective.md`.

## Data sources and workflow (current)
- Search/data pages load from `src/data.json`.
- Visualization page loads from CSV exports in `static/` (see `static/node-export.csv` and `static/relationship-export.csv`).
- If you update Neo4j data, ensure both JSON and CSV exports stay in sync, or establish a single source of truth.

## Data pipeline (proposed)
- Canonical source: Neo4j graph.
- Export step: Neo4j -> JSON for Eleventy, and (if needed) CSV for visualization.
- Document the exact export command or script here once stabilized.

## Development
- Start: `npm run start`
- Build: `npm run build`

## Deployment checklist (GitHub Pages)
1) Pages source set to **GitHub Actions** (not `/docs` branch).
2) Build output matches workflow artifact path (`dist`).
3) `pathPrefix` set for project site (`/MATHesis/`) in production.
4) All asset/route links use Eleventy `| url` filter or base-aware fetch.
5) Push a change and verify CSS/JS/network requests in the deployed site.
