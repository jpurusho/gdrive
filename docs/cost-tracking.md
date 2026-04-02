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

> **Note:** These are estimates based on conversation length and content volume.
> For exact figures, check the AWS Bedrock usage dashboard in the AWS Console
> under CloudWatch > Metrics > Bedrock > ModelId.

---

## Running Totals

| Metric | Value |
|--------|-------|
| **Total input tokens** | ~130,000 |
| **Total output tokens** | ~108,000 |
| **Total cost** | **~$2.80** |
| Sessions completed | 1 |

---

## How to Verify Actual Usage

1. **AWS Console** → CloudWatch → Metrics → Bedrock
2. Filter by ModelId: `us.anthropic.claude-opus-4-6-v1`
3. Look at `InputTokenCount` and `OutputTokenCount` metrics
4. Or check **AWS Cost Explorer** → filter by Bedrock service

Alternatively, if using Claude Code directly:
- Check the token usage displayed at the end of each conversation
- The CLI shows input/output token counts per session
