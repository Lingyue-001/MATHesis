# AGENTS Instructions

## Startup Context Rule
At the start of every new Codex session in this repository, read these files first before any edits:
1. `NOTE_当前需求清单和待办_Current_Status_and_Todo.md`
2. `LOG_已完成改动和复盘_Completed_Changes_and_Retrospective.md`
3. `README.md`

## Purpose Split
- `NOTE_当前需求清单和待办_Current_Status_and_Todo.md`:
  only current status, open issues, and prioritized todos.
- `LOG_已完成改动和复盘_Completed_Changes_and_Retrospective.md`:
  only completed changes, implementation steps, and retrospectives.

## Logging Convention
When adding a completed event to log, use one entry per event with:
1. Time
2. 需求明确 / Goal
3. 操作 / Actions
4. 解决 / Outcome
5. 复盘 / Retrospective

## Transcription HTML UI Guardrail
For any newly imported transcription HTML page under `src/transcriptions/tei_hanshu/`:
1. Keep the project top header/navigation bar visible at the top.
2. Add a visible back button (prefer: back to transcriptions list; fallback to browser history back).

## Data Safety Guardrail (High Priority)
- For node-entry discussions and UI iteration, changes must stay in display/render logic only.
- Do **not** modify or delete canonical data source files such as `src/data.json` unless the user explicitly asks for data-layer edits in that turn.
- Search matching behavior may evolve in code, but underlying JSON records must be preserved as source of truth.

## Commit Message Convention (Codex Auto Push)
- For Codex-generated auto-push commits, do **not** use `feat:` as the message prefix.
- End commit messages with: `Implemented with Codex assistance.`
