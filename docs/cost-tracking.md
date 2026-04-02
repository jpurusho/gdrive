# Project Cost Tracking

## AWS Bedrock Pricing (Claude Opus 4.6)

| Metric | Rate |
|--------|------|
| Input tokens | $5.00 / 1M tokens |
| Output tokens | $25.00 / 1M tokens |
| Cache read | $0.50 / 1M tokens |
| Cache write (5 min) | $6.25 / 1M tokens |

Source: AWS Bedrock Pricing API (2026-03-13) + Anthropic docs

---

## Session Log

### Session 1 — Phase 1: Project Scaffold + OAuth + Dashboard + Docs
**Date:** 2026-04-02

**Work done:**
- Reviewed existing Docker-based codebase
- Designed Electron app architecture
- Scaffolded full project: desktop/, frontend/, shared/, docs/, scripts/
- Wrote all Phase 1 source code (OAuth, Drive tree, Local tree, Dashboard, Sidebar, Login, SyncCards)
- Set up build tooling (Vite + tsc + electron-builder)
- Resolved native module build issues (better-sqlite3 + Python 3.14)
- Wrote architecture docs with Mermaid diagrams
- Created CI/CD workflow
- Verified production build

**Estimated token usage:**

| Metric | Tokens | Cost |
|--------|--------|------|
| Input tokens | ~100,000 | $0.50 |
| Output tokens | ~70,000 | $1.75 |
| Subagent (pricing research) | ~68,000 (combined) | ~$0.55 |
| **Session total** | **~238,000** | **~$2.80** |

---

### Session 2 — Phases 2-5: Complete Implementation
**Date:** 2026-04-02

**Work done:**
- Cleaned up workspace: removed old Docker/Python backend, legacy frontend
- Added 6-theme system (Midnight, GitHub Dark, Dracula, Nord, One Dark Pro, Light)
- Theme selector with mini preview cards in Settings
- Phase 2: Sync profile CRUD (database + IPC + dialog + card UI)
- Phase 2: CreateProfileDialog with drive folder picker, permission-aware direction
- Phase 2: SyncCards with glowing pulse animation, progress bars
- Phase 3: Sync engine (download, upload, bidirectional)
- Phase 3: MD5 checksum comparison, Google Workspace export, streaming transfers
- Phase 3: Sync history + per-file logging in SQLite
- Phase 4: node-cron scheduler with preset schedules
- Phase 4: Activity History page with status table and live updates
- Phase 5: Settings page polish (version, platform, update check)
- Phase 5: Updated architecture and phase docs
- Committed and pushed each phase incrementally

**Estimated token usage:**

| Metric | Tokens | Cost |
|--------|--------|------|
| Input tokens | ~200,000 | $1.00 |
| Output tokens | ~120,000 | $3.00 |
| Subagent (exploration) | ~50,000 (combined) | ~$0.40 |
| **Session total** | **~370,000** | **~$4.40** |

---

## Running Totals

| Metric | Value |
|--------|-------|
| **Total input tokens** | ~350,000 |
| **Total output tokens** | ~258,000 |
| **Total cost** | **~$7.20** |
| Sessions completed | 2 |

---

## How to Verify Actual Usage

1. **AWS Console** -> CloudWatch -> Metrics -> Bedrock
2. Filter by ModelId: `us.anthropic.claude-opus-4-6-v1`
3. Look at `InputTokenCount` and `OutputTokenCount` metrics
4. Or check **AWS Cost Explorer** -> filter by Bedrock service

Alternatively, if using Claude Code directly:
- Check the token usage displayed at the end of each conversation
- The CLI shows input/output token counts per session
