# PDF GitHub Links — Implementation Plan

**Goal:** Enable clickable links in the PDF report that open the actual GitHub repository at the exact file and line of code being referenced.

**Branch:** `feature/pdf-github-links` (on `origin`; no `pdf-links` branch exists)

**Current state:** The PDF generator already has `generateFileLink()`, `drawClickableGitHubLogo()`, and `PdfReportOptions.analyzedRepo` / `analyzedRef`. However, the CLI does **not** pass these options, so links fall back to a hardcoded `Arsh-S/Dispatch` repo — wrong for user scans.

---

## Problem Summary

| Component | Current behavior | Desired behavior |
|-----------|------------------|-------------------|
| **CLI `scan`** | Passes `githubRepo`, `githubRef` only | Also pass `analyzedRepo`, `analyzedRef` so file links point to the scanned repo |
| **CLI `report`** | Passes `--repo`, `--ref` as `githubRepo`, `githubRef` only | Pass them as `analyzedRepo`, `analyzedRef` for file permalinks |
| **PDF generator** | Falls back to `Arsh-S/Dispatch` when `analyzedRepo` is missing | No links when repo unknown; never hardcode a default repo |
| **Orchestrator** | Returns `gitSha` only | Optionally return `gitRemote` (owner/repo) for inference |

---

## Phase 1: Thread `analyzedRepo` and `analyzedRef` Through the CLI

### Task 1.1 — Infer GitHub repo from git remote (optional)

**File:** `backend/src/orchestrator/agent.ts`

Add optional `gitRemote` to `OrchestratorResult`:

```typescript
export interface OrchestratorResult {
  preRecon: PreReconDeliverable;
  assignments: TaskAssignment[];
  workerResults: WorkerResult[];
  mergedReport: MergedReport | null;
  gitSha?: string;
  gitRemote?: string;  // "owner/repo" from origin, if GitHub
}
```

In `runOrchestrator`, after capturing `gitSha`, try to infer the remote:

```typescript
let gitRemote: string | undefined;
try {
  const url = execSync('git remote get-url origin', { cwd: options.targetDir })
    .toString().trim();
  // Parse https://github.com/owner/repo.git or git@github.com:owner/repo.git
  const match = url.match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
  if (match) gitRemote = match[1];
} catch { /* no remote or not GitHub */ }
```

Return `gitRemote` in the result object.

**Rationale:** When the user scans a local clone without passing `--repo`, we can still produce correct links if the clone has a GitHub origin.

---

### Task 1.2 — Pass `analyzedRepo` and `analyzedRef` in `scan` command

**File:** `backend/src/cli.ts`

Resolve the analyzed repo (in order of precedence):

1. Explicit `githubRepo` from args or `GITHUB_REPO` (user-provided)
2. `result.gitRemote` from orchestrator (inferred from git remote)
3. `undefined` — PDF will not add file links

Update the `generatePdfReport` call:

```typescript
const analyzedRepo = githubRepo ?? result.gitRemote;
const analyzedRef = result.gitSha ?? 'main';

await generatePdfReport(report, pdfPath, {
  githubRepo,
  githubRef: result.gitSha ?? 'main',
  analyzedRepo: analyzedRepo ?? undefined,
  analyzedRef,
  createdIssues: issueMap.size > 0 ? issueMap : undefined,
});
```

**Note:** When neither `githubRepo` nor `gitRemote` is available, `analyzedRepo` is `undefined` — the PDF generator must handle this gracefully (no links, no hardcoded fallback).

---

### Task 1.3 — Pass `analyzedRepo` and `analyzedRef` in `report` command

**File:** `backend/src/cli.ts`

The standalone `report` command already accepts `--repo` and `--ref`. Pass them as both `githubRepo`/`githubRef` and `analyzedRepo`/`analyzedRef`:

```typescript
await generatePdfReport(data, pdfOutputPath, {
  githubRepo: repoFlag,
  githubRef: refFlag || 'main',
  analyzedRepo: repoFlag ?? undefined,
  analyzedRef: refFlag || 'main',
});
```

---

## Phase 2: Fix PDF Generator Fallback Behavior

### Task 2.1 — Remove hardcoded `Arsh-S/Dispatch` fallback

**File:** `backend/src/reporting/pdf.ts`

In `generateFileLink`:

```typescript
function generateFileLink(
  file: string,
  line: number | undefined,
  analyzedRepo?: string,
  analyzedRef?: string,
): string | undefined {
  if (!analyzedRepo) return undefined;  // No fallback — caller handles missing links
  const ref = analyzedRef || 'main';
  const cleanFile = file.startsWith('/') ? file.slice(1) : file;
  if (!line || line <= 0) {
    return `https://github.com/${analyzedRepo}/blob/${ref}/${cleanFile}`;
  }
  return `https://github.com/${analyzedRepo}/blob/${ref}/${cleanFile}#L${line}`;
}
```

In `drawClickableGitHubLogo`, skip drawing the link when `generateFileLink` returns `undefined`:

```typescript
const linkUrl = generateFileLink(file, line, analyzedRepo, analyzedRef);
if (!linkUrl) return;
doc.link(x, y, width, height, linkUrl);
if (fs.existsSync(GITHUB_LOGO_PATH)) {
  doc.image(GITHUB_LOGO_PATH, x, y, { width, height });
}
```

**Rationale:** When the user scans a non-GitHub repo or doesn't provide repo info, we should not fabricate links to a random repo. Graceful degradation = no clickable logo, plain text only.

---

### Task 2.2 — Make file path text clickable when link is available

**File:** `backend/src/reporting/pdf.ts`

In `drawExecutiveSummary` and `drawFindingFull` / `drawFindingCondensed`, the file path is currently plain text. When `analyzedRepo` is set, make the path itself clickable (in addition to the logo):

```typescript
const linkUrl = generateFileLink(f.location.file, f.location.line, analyzedRepo, analyzedRef);
if (linkUrl) {
  doc.text(locTruncated, colX, cellY, { link: linkUrl, underline: true });
} else {
  doc.text(locTruncated, colX, cellY, { lineBreak: false });
}
```

Apply the same pattern in `drawFindingFull` and `drawFindingCondensed` for the file reference line.

---

## Phase 3: Slack / Dashboard Integration (Optional)

If the Slack bot or dashboard triggers scans, ensure they pass `analyzedRepo` and `analyzedRef` when generating PDFs. Trace the flow:

- **Slack:** `handlers.ts` → agent config has `githubRepo`; PDF generation may happen in a different path. Verify and add `analyzedRepo`/`analyzedRef` if PDF is generated from Slack-triggered runs.
- **Dashboard:** Check if the dashboard generates PDFs; if so, ensure it receives and passes repo/ref from the scan context.

---

## Phase 4: Testing

### Unit tests

**File:** `backend/src/reporting/__tests__/pdf.test.ts`

1. **`generateFileLink` / `githubFileUrl`:** When `analyzedRepo` is `undefined`, no link is produced.
2. **With `analyzedRepo`:** Links use the provided repo and ref (e.g. `acme/app`, `main`).
3. **Line numbers:** `#L42` appended when `line > 0`; omitted when `line <= 0`.

### Manual verification

1. `pnpm tsx src/cli.ts scan ./path-to-your-repo owner/repo` → PDF file links open `owner/repo` on GitHub.
2. `pnpm tsx src/cli.ts scan ./path-to-clone` (no repo arg, but clone has `origin` on GitHub) → links use inferred repo.
3. `pnpm tsx src/cli.ts report dispatch-output.json out.pdf --repo=owner/repo --ref=main` → links work.
4. `pnpm tsx src/cli.ts scan ./non-git-dir` → PDF has no clickable links (graceful degradation).

---

## Dependency Order

```
Phase 1.1 (orchestrator gitRemote) ──┐
                                      ├──► Phase 1.2, 1.3 (CLI) ──► Phase 2 (PDF) ──► Phase 3 (Slack/Dashboard) ──► Phase 4 (Tests)
Phase 2.1 (remove fallback) ──────────┘
```

Phase 2.1 can be done in parallel with Phase 1; it's independent. Phase 1.2/1.3 depend on Phase 1.1 only if you want automatic inference from git remote.

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/src/orchestrator/agent.ts` | Add `gitRemote` to result, infer from `git remote get-url origin` |
| `backend/src/cli.ts` | Pass `analyzedRepo`, `analyzedRef` in both `scan` and `report` paths |
| `backend/src/reporting/pdf.ts` | Remove `Arsh-S/Dispatch` fallback; return `undefined` when no repo; make file paths clickable when link available |
| `backend/src/reporting/__tests__/pdf.test.ts` | Add tests for link generation with/without repo |
| `backend/src/slack/handlers.ts` | (If applicable) Pass `analyzedRepo`/`analyzedRef` when generating PDF from Slack |

---

## Merge Strategy

1. Merge `feature/pdf-github-links` into `main` (it adds the logo + link infrastructure).
2. Apply Phase 1–2 changes on top to complete the data flow.
3. Run Phase 4 tests before merging.
