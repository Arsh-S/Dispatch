# Plan: LLM-Generated Code Fixes in Constructor Worker

**Date:** 2026-03-15
**Branch:** `feat/llm-constructor-fix` (worktree off `main`)

---

## Background

The constructor worker currently applies security fixes using hardcoded regex patterns in `fix.ts`. These work for narrow cases (e.g. Python f-string SQL injection) but cannot generalize to new vulnerability types or handle nuanced code structures.

This plan replaces the regex approach with a Claude API call that reads the actual vulnerable file and generates a real, context-aware fix — while keeping the regex logic as a fallback.

---

## Goal

When the constructor worker processes a Linear issue, instead of applying a pattern match:

1. Read the vulnerable file from the cloned repo
2. Send the file content + issue details to Claude
3. Claude returns the complete fixed file
4. Write the fixed file to disk and continue to PR creation

---

## Affected Files

| File | Change |
|------|--------|
| `backend/package.json` | Add `@anthropic-ai/sdk` dependency |
| `backend/src/workers/constructor/llm-fix.ts` | **Create** — LLM fix logic |
| `backend/src/workers/constructor/fix.ts` | Modify `applyFix()` entry point to try LLM first |
| `backend/src/workers/constructor/__tests__/llm-fix.test.ts` | **Create** — unit tests for response parsing |

**Unchanged:** `parse.ts`, `pr.ts`, `types.ts`, `cli.ts`, `index.ts`

---

## Phase 1 — Install Dependency

```bash
cd backend && pnpm add @anthropic-ai/sdk
```

`ANTHROPIC_API_KEY` is already injected into the Blaxel sandbox env in `constructor-dispatcher.ts`.

---

## Phase 2 — Create `llm-fix.ts`

**Path:** `backend/src/workers/constructor/llm-fix.ts`

### Signature

```typescript
export async function applyFixWithLLM(
  parsed: ParsedIssue,
  bootstrap: ConstructorBootstrap,
): Promise<FixResult>
```

### Steps

1. Resolve the target file: `path.resolve(process.env.REPO_DIR || '/repo', parsed.location.file)`
2. Read file content from disk; return `fix_failed` if not found
3. Build Claude messages (see prompts below)
4. Call `anthropic.messages.create()`:
   - `model`: `'claude-sonnet-4-6'`
   - `max_tokens`: `8192`
   - `temperature`: `0` (deterministic)
5. Extract fixed content from `<fixed_file>...</fixed_file>` XML tags in the response
6. If content is `UNABLE_TO_FIX` or identical to original, return `fix_failed`
7. Write fixed content to disk
8. Return `FixResult` with `status: 'fix_verified'` (or `'fix_unverified'` if `exploit_confidence === 'unconfirmed'`)

### System Prompt

```
You are an expert application security engineer. Your task is to fix a security vulnerability in a source code file.

Rules:
- Apply the MINIMAL change that correctly fixes the vulnerability.
- Do NOT refactor, rename, or reorganize unrelated code.
- Preserve the existing code style, formatting, and indentation exactly.
- Return the COMPLETE fixed file content inside <fixed_file> XML tags.
- If you cannot safely fix the vulnerability without breaking functionality,
  return <fixed_file>UNABLE_TO_FIX</fixed_file> and explain why in <explanation> tags.
```

### User Message Template

```
Fix the following security vulnerability.

## Vulnerability Details
- **Type:** {parsed.vuln_type}
- **Severity:** {parsed.severity}
- **CVSS Score:** {parsed.cvss_score ?? 'N/A'}
- **OWASP:** {parsed.owasp ?? 'N/A'}
- **Exploit Confidence:** {parsed.exploit_confidence}

## Location
- **File:** {parsed.location.file}
- **Line:** {parsed.location.line}
- **Endpoint:** {parsed.location.method} {parsed.location.endpoint}
- **Affected Parameter:** {parsed.location.parameter ?? 'N/A'}

## Description
{parsed.description}

## Recommended Fix
{parsed.recommended_fix}

[if monkeypatch_diff present:]
## Validated Monkeypatch Diff
This diff was confirmed to fix the vulnerability:
\`\`\`diff
{parsed.monkeypatch_diff}
\`\`\`

[if reproduction_command present:]
## Reproduction Command
\`\`\`bash
{parsed.reproduction_command}
\`\`\`

## Source File
\`\`\`
{fileContent}
\`\`\`

Return the complete fixed file inside <fixed_file></fixed_file> tags.
```

### Response Parsing

```typescript
export function extractFixedContent(response: string): string | null {
  const match = response.match(/<fixed_file>([\s\S]*?)<\/fixed_file>/);
  if (!match) return null;
  const content = match[1].trim();
  if (content === 'UNABLE_TO_FIX') return null;
  return content;
}
```

---

## Phase 3 — Modify `fix.ts`

Change only the `applyFix()` entry function to try LLM first, fall through to existing regex on failure:

```typescript
export async function applyFix(
  parsed: ParsedIssue,
  bootstrap: ConstructorBootstrap,
): Promise<FixResult> {
  // Attempt LLM-based fix first
  try {
    const llmResult = await applyFixWithLLM(parsed, bootstrap);
    if (llmResult.status !== 'fix_failed' && llmResult.files_changed.length > 0) {
      console.log(`[Constructor Fix] LLM fix succeeded`);
      return llmResult;
    }
    console.warn(`[Constructor Fix] LLM produced no changes, falling back to regex`);
  } catch (err: any) {
    console.warn(`[Constructor Fix] LLM failed (${err.message}), falling back to regex`);
  }

  // Existing regex fallback — unchanged
  const strategy = getStrategy(parsed.exploit_confidence, parsed.monkeypatch_status);
  // ... rest of current code ...
}
```

All existing regex functions (`fixSqlInjection`, `fixBrokenAuth`, `fixXss`, `fixIdor`, `applyMonkeypatchAsBase`) remain untouched.

---

## Phase 4 — Unit Tests

**Path:** `backend/src/workers/constructor/__tests__/llm-fix.test.ts`

Test `extractFixedContent()`:

| Case | Input | Expected |
|------|-------|----------|
| Happy path | `<fixed_file>def foo(): pass</fixed_file>` | `"def foo(): pass"` |
| UNABLE_TO_FIX | `<fixed_file>UNABLE_TO_FIX</fixed_file>` | `null` |
| No tags | `Here is the fix: def foo(): pass` | `null` |
| Extra whitespace | `<fixed_file>\n  code\n</fixed_file>` | `"code"` |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `ANTHROPIC_API_KEY` missing | SDK throws → caught → regex fallback |
| API 429 / 529 | SDK retries (2x default) → if still fails → regex fallback |
| Response has no `<fixed_file>` tags | `extractFixedContent` returns null → `fix_failed` from LLM → regex fallback |
| Fixed content identical to original | Treated as no change → regex fallback |
| Target file not found | Return `fix_failed` immediately (same as current behavior) |

---

## Open Questions

1. **`max_tokens` sizing** — 8192 is sufficient for most files. For files >2000 lines, consider `Math.max(8192, Math.ceil(fileContent.length * 1.5 / 4))` capped at 16384.
2. **Multi-file vulns** — out of scope; architecture fixes one file at a time.
3. **LLM timeout** — consider a 60s timeout on the API call independent of the sandbox TTL.
