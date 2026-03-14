# PDF Report Overhaul — Implementation Plan

> **⚡ PREREQUISITE — Before executing any phase of this plan, run the `/prime` command to initialize your understanding of the codebase architecture. Do not proceed until priming is complete.**

**Created:** 2026-03-14
**Status:** Draft
**Scope:** Overhaul the PDF report generator (`backend/src/reporting/pdf.ts`) for better formatting, clickable GitHub references, issue cross-linking, and developer-focused UX.

---

## Clarification Log

All ambiguities from the original request have been resolved through code analysis:

| Question | Resolution |
|:---|:---|
| Is the scanned target always a GitHub repo? | No — `githubRepo` is optional in the CLI (`args[2]` or `GITHUB_REPO` env). All GitHub link features must degrade gracefully to plain text. |
| How to determine git ref for permalink URLs? | The orchestrator does not currently capture the commit SHA. Plan Phase 1 adds this. Fall back to `main` if unavailable. |
| How are findings matched to created issues? | `cli.ts:69-71` creates issues in the same order as `report.findings`. The `finding_id` field is the join key — `convertToIssueFormat` sets `dispatch_worker_id: finding.finding_id`. |
| Are clean_endpoints deduplicated? | No — `collector.ts:45` pushes all raw clean endpoints. Dedup/grouping is handled at the presentation layer (this plan, Phase 2). |
| What fonts are feasible? | PDFKit supports embedded TTF. Inter + JetBrains Mono are OFL-licensed. Font files must ship in `backend/assets/fonts/`. |

---

## Dependency Map

```
Phase 1 (Data Flow) ──┐
                       ├──► Phase 2 (Layout & Content) ──► Phase 3 (Visual Polish)
Font acquisition ──────┘
```

- **Phase 2 depends on Phase 1** — clickable links require `githubRepo` and `createdIssues` to be available in the PDF generator.
- **Font files** can be acquired in parallel with Phase 1 code changes.
- **Phase 3** is purely cosmetic and depends on Phase 2 being structurally complete.
- **No external blockers** — all changes are within the `backend/` directory and require no new API permissions.

---

## Phase 1: Data Flow (MVP/Foundational)

**Goal:** Thread GitHub repo info and created issue URLs into the PDF generator so all downstream phases can use them.

### Task 1.1 — Define `PdfReportOptions` interface

**File:** `backend/src/reporting/pdf.ts`

Add a new interface before `generatePdfReport`:

```typescript
export interface PdfReportOptions {
  githubRepo?: string;       // "owner/repo" — enables file permalink URLs
  githubRef?: string;        // commit SHA or branch name (default: "main")
  createdIssues?: Map<string, { number: number; url: string }>; // finding_id → GitHub issue
}
```

**Why a new interface instead of adding fields to `MergedReport`:** `MergedReport` is a pure scan output from the collector. Presentation metadata (repo URLs, issue links) belongs in the rendering layer, not the data layer.

### Task 1.2 — Update `generatePdfReport` signature

**File:** `backend/src/reporting/pdf.ts`

Change:
```typescript
export async function generatePdfReport(
  scanResult: MergedReport,
  outputPath: string,
): Promise<string>
```

To:
```typescript
export async function generatePdfReport(
  scanResult: MergedReport,
  outputPath: string,
  options?: PdfReportOptions,
): Promise<string>
```

Pass `options` (defaulting to `{}`) through to all `drawFinding*` functions. Update each drawing function's signature to accept the options parameter.

### Task 1.3 — Add `githubFileUrl` helper

**File:** `backend/src/reporting/pdf.ts`

```typescript
function githubFileUrl(
  repo: string,
  ref: string,
  file: string,
  line?: number,
): string {
  const base = `https://github.com/${repo}/blob/${ref}/${file}`;
  if (!line || line <= 0) return base;
  return `${base}#L${line}`;
}
```

**Edge case:** Line number `0` (observed in real output `comments.ts:0`) — omit the `#L0` fragment since it's meaningless. The condition `line <= 0` handles this.

### Task 1.4 — Thread issue URLs and repo info from CLI

**File:** `backend/src/cli.ts`

After issue creation (line 71) and before PDF generation (line 81), build the issue map:

```typescript
// Build issue map for PDF cross-referencing
const issueMap = new Map<string, { number: number; url: string }>();
if (issues) {
  report.findings.forEach((f, i) => {
    if (issues[i]) {
      issueMap.set(f.finding_id, { number: issues[i].number, url: issues[i].url });
    }
  });
}

// Generate PDF with GitHub context
await generatePdfReport(report, pdfPath, {
  githubRepo,
  githubRef: 'main', // TODO: Task 1.5 captures actual SHA
  createdIssues: issueMap.size > 0 ? issueMap : undefined,
});
```

**Note:** When `githubRepo` is undefined (user didn't provide it), `options.githubRepo` is `undefined` and all link features degrade to plain text. No conditional branching needed in the CLI — the PDF generator handles this internally.

Also update the `report` command path (lines 107-119) to accept optional `--repo` and `--ref` flags so standalone `pnpm report` can also produce linked PDFs:

```typescript
} else if (command === 'report') {
  const inputPath = args[1] || path.join(process.cwd(), 'dispatch-output.json');
  const pdfOutputPath = args[2] || inputPath.replace(/\.json$/, '.pdf');
  const repoFlag = args.find(a => a.startsWith('--repo='))?.split('=')[1];
  const refFlag = args.find(a => a.startsWith('--ref='))?.split('=')[1];
  // ...
  await generatePdfReport(data, pdfOutputPath, {
    githubRepo: repoFlag,
    githubRef: refFlag || 'main',
  });
}
```

### Task 1.5 — Capture git SHA at scan time (optional but recommended)

**File:** `backend/src/orchestrator/agent.ts`

Before running pre-recon, capture the target repo's HEAD SHA:

```typescript
import { execSync } from 'child_process';

// Inside runOrchestrator, before Phase 0:
let gitSha: string | undefined;
try {
  gitSha = execSync('git rev-parse HEAD', { cwd: options.targetDir })
    .toString().trim();
} catch { /* not a git repo — gitSha stays undefined */ }
```

Add `gitSha` to `OrchestratorResult` so the CLI can pass it as `githubRef`. This gives permalink stability — the code won't change between scan and developer click.

### Task 1.6 — Update PDF test suite

**File:** `backend/src/reporting/__tests__/pdf.test.ts`

- Add tests for the new `options` parameter (with and without GitHub context).
- Verify that when `githubRepo` is provided, the PDF buffer contains GitHub URLs.
- Verify graceful degradation when `options` is omitted or `githubRepo` is undefined.

### Phase 1 — Done Criteria

- [ ] `generatePdfReport` accepts `PdfReportOptions` as third argument
- [ ] CLI passes `githubRepo`, `githubRef`, and `createdIssues` to PDF generator
- [ ] `pnpm report` accepts `--repo=` and `--ref=` flags
- [ ] Git SHA captured at scan time and available in `OrchestratorResult`
- [ ] Existing tests pass unchanged (backward-compatible — `options` is optional)
- [ ] New tests cover: options present, options absent, line=0 edge case

---

## Phase 2: Layout & Content (Scaling/Refining)

**Goal:** Fix structural layout problems, add clickable references, redesign finding cards, and improve information density.

### Task 2.1 — Fix executive summary layout

**File:** `backend/src/reporting/pdf.ts`, function `drawExecutiveSummary`

**Problem:** After the severity bar chart loop (lines 163-175), `doc.y` is correct but `doc.x` has drifted because of the `doc.text()` calls with explicit x positions. The "Endpoint Coverage" section renders displaced to the right.

**Fix:** After the bar chart loop, explicitly reset the cursor:

```typescript
// After the severity bar loop:
doc.x = doc.page.margins.left;  // Reset X to left margin
doc.moveDown(1);
```

Additionally, restructure the executive summary into clearly separated horizontal bands:

1. **Title banner** (dark navy, full width) — "DISPATCH" + "Security Scan Report" — keep as-is
2. **Metadata strip** — Run ID, timestamp, duration — keep as-is but use human-readable date
3. **Risk score block** — keep as-is
4. **Severity breakdown** — fix bar chart count alignment: render counts at `barStartX + 70 + filledWidth` (immediately after bar) instead of `barStartX + 70 + barWidth * 0.7` (fixed far-right position)
5. **Endpoint coverage** — render below severity breakdown at explicit `doc.y`, not wherever the cursor ended up
6. **Finding summary table** — new section (Task 2.3)

### Task 2.2 — Eliminate empty pages

**File:** `backend/src/reporting/pdf.ts`, main `generatePdfReport` function

**Problem:** Lines 58, 74, 84 unconditionally call `doc.addPage()` for each section. A single medium finding gets an entire page. Clean endpoints get an entire page.

**Fix:** Replace unconditional page breaks with conditional ones:

```typescript
// Before critical/high section (currently line 58):
if (criticalHighFindings.length > 0) {
  if (doc.y > 500) doc.addPage();  // Only break if not enough room
  else doc.moveDown(2);
  drawSectionHeader(doc, 'Critical & High Severity Findings');
  // ...
}

// Before medium/low section (currently line 74):
if (mediumLowFindings.length > 0) {
  if (doc.y > 500) doc.addPage();
  else doc.moveDown(2);
  drawSectionHeader(doc, 'Medium & Low Severity Findings');
  // ...
}

// Before clean endpoints (currently line 84):
if (scanResult.clean_endpoints.length > 0) {
  if (doc.y > 600) doc.addPage();
  else doc.moveDown(2);
  drawSectionHeader(doc, 'Clean Endpoints');
  // ...
}
```

Also within finding loops, improve page-break logic to be content-aware:

```typescript
// Instead of: if (doc.y > 650) doc.addPage();
// Estimate next finding height (rough: 150px for full, 60px for condensed):
const estimatedHeight = isFull ? 150 : 60;
if (doc.y + estimatedHeight > doc.page.height - doc.page.margins.bottom - 40) {
  doc.addPage();
}
```

### Task 2.3 — Add finding summary table to executive summary

**File:** `backend/src/reporting/pdf.ts`, function `drawExecutiveSummary`

After "Endpoint Coverage", render a compact summary table of all findings:

```
 #  │ Severity │ Type           │ Location                      │ Issue
 1  │ MEDIUM   │ XSS            │ src/routes/comments.ts:42     │ #17
 2  │ LOW      │ Open Redirect  │ src/routes/auth.ts:8          │ —
```

Each file path cell should be a clickable GitHub link (if `options.githubRepo` is set).
Each issue number should be a clickable link to the GitHub issue URL (if `options.createdIssues` has an entry).

Implementation notes:
- Use `doc.text(displayText, { link: url })` for clickable cells.
- File path display: show the path as-is if ≤ 45 chars; if longer, truncate to last 3 segments (`…/routes/comments.ts:42`) but keep the full path in the URL.
- If there are 0 findings, skip this section entirely.
- If there are > 15 findings, show the first 15 and add a "(N more — see details below)" note.

### Task 2.4 — Add clickable GitHub file references to findings

**File:** `backend/src/reporting/pdf.ts`, functions `drawFindingFull` and `drawFindingCondensed`

In `drawFindingFull` (line 220-224), change the location text from:

```typescript
doc.text(`${finding.location.method} ${finding.location.endpoint}  |  ${finding.location.file}:${finding.location.line}`, x + 10);
```

To two separate lines for clarity:

```typescript
// Endpoint line
doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text);
doc.text(`${finding.location.method} ${finding.location.endpoint}`, x + 10);

// File reference line — clickable if GitHub repo is available
const fileRef = finding.location.line > 0
  ? `${finding.location.file}:${finding.location.line}`
  : finding.location.file;

if (options?.githubRepo) {
  const url = githubFileUrl(
    options.githubRepo,
    options.githubRef || 'main',
    finding.location.file,
    finding.location.line,
  );
  doc.font('Courier').fontSize(8).fillColor('#2563EB');
  doc.text(fileRef, x + 10, doc.y, { link: url, underline: true });
} else {
  doc.font('Courier').fontSize(8).fillColor(COLORS.text);
  doc.text(fileRef, x + 10);
}
```

Apply the same pattern to `drawFindingCondensed`.

**Display format:** `src/routes/comments.ts:42` — standard `file:line` convention. For line ranges (not currently in the schema but future-safe): `src/routes/comments.ts:42-58`.

### Task 2.5 — Add GitHub issue badge to findings

**File:** `backend/src/reporting/pdf.ts`, functions `drawFindingFull` and `drawFindingCondensed`

When `options.createdIssues?.has(finding.finding_id)` is true, render an issue badge next to the severity badge:

```typescript
const issue = options?.createdIssues?.get(finding.finding_id);
if (issue) {
  // Render a small linked badge: "Issue #42"
  const issueText = `Issue #${issue.number}`;
  const issueX = x + pageWidth - 140; // Left of severity badge
  doc.font('Helvetica').fontSize(7).fillColor('#2563EB');
  doc.text(issueText, issueX, headerY + 4, { link: issue.url, underline: true });
}
```

Position the issue badge to the left of the existing severity badge in the finding header row.

### Task 2.6 — Redesign finding cards for visual hierarchy

**File:** `backend/src/reporting/pdf.ts`, function `drawFindingFull`

Restructure each finding into a clear visual card:

1. **Header row:** Severity stripe (widen from 4px to 6px) + `#N VULN_TYPE` (bold, 10pt) + Issue badge (right) + Severity badge (far right)
2. **Location block:** Endpoint on line 1 (bold), File:line on line 2 (Courier, clickable blue), Parameter on line 3 (if present)
3. **Metadata row:** `CVSS 9.1 · A03:2021 · Confirmed · Patched ✓` — use middle-dot separators (cleaner than pipes)
4. **Description:** Body text (9pt, dark gray)
5. **Reproduction block:** Subsection header (bold, indigo) + code block with light gray background (`#F3F4F6` filled rect behind Courier text)
6. **Monkeypatch block:** Same code-block treatment for diffs
7. **Recommended Fix:** Subsection header + body text
8. **Rules violated:** Compact list
9. **Separator:** Thin line + 12px gap (increased from current 8px)

For code blocks (reproduction curl commands, diffs), add a background:

```typescript
// Before rendering code text:
const codeBlockHeight = doc.heightOfString(codeText, { width: pageWidth - 28 }) + 8;
doc.rect(x + 10, doc.y - 2, pageWidth - 20, codeBlockHeight + 4)
  .fill('#F3F4F6');
doc.font('Courier').fontSize(7).fillColor(COLORS.text);
doc.text(codeText, x + 14, doc.y + 2, { width: pageWidth - 28 });
```

### Task 2.7 — Group clean endpoints by route

**File:** `backend/src/reporting/pdf.ts`, function `drawCleanEndpoints`

Replace flat list with grouped rendering:

```typescript
function drawCleanEndpoints(doc: PDFKit.PDFDocument, report: MergedReport) {
  const x = doc.page.margins.left;

  // Group by "METHOD endpoint"
  const groups = new Map<string, Array<{ parameter: string; attack_type: string; notes: string }>>();
  for (const ep of report.clean_endpoints) {
    const key = ep.endpoint; // e.g., "GET /api/orders"
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      parameter: ep.parameter || '',
      attack_type: ep.attack_type,
      notes: ep.notes,
    });
  }

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
  doc.text(`${groups.size} unique endpoints passed all attack vectors:`, x);
  doc.moveDown(0.4);

  for (const [endpoint, params] of groups) {
    if (doc.y > 700) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.LOW);
    doc.text(endpoint, x + 8);

    for (const p of params) {
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
      const paramLabel = p.parameter ? p.parameter : 'all';
      doc.text(`  ✓ ${paramLabel} (${p.attack_type})`, x + 16);
    }
    doc.moveDown(0.3);
  }
}
```

**Note on the `endpoint` field:** Looking at `CleanEndpointSchema` (finding-report.ts:49-54), the `endpoint` field is a string like `GET /api/orders`. The grouping key is this full string. If endpoints don't include the method prefix, use just the path and render the method separately.

### Task 2.8 — Human-readable timestamps

**File:** `backend/src/reporting/pdf.ts`, function `drawExecutiveSummary`

Change line 130 from:
```typescript
doc.text(`Completed: ${new Date(report.completed_at).toLocaleString()}`);
```

To:
```typescript
const d = new Date(report.completed_at);
const formatted = d.toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric',
}) + ' at ' + d.toLocaleTimeString('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true,
});
doc.text(`Completed: ${formatted}`);
```

Output: `"March 14, 2026 at 2:42 PM"` instead of `"3/14/2026, 2:42:03 PM"`.

### Phase 2 — Done Criteria

- [ ] Executive summary renders with all sections properly stacked vertically (no floating)
- [ ] Severity bar chart counts appear immediately after their bars
- [ ] No section produces an entirely empty page
- [ ] Finding summary table appears on page 1 with clickable links (when GitHub context available)
- [ ] File paths in findings are clickable GitHub permalinks (when repo is provided)
- [ ] File paths render as plain `Courier` text when no repo is provided
- [ ] GitHub issue badge appears next to findings with corresponding issues
- [ ] Clean endpoints are grouped by route
- [ ] Timestamps display as human-readable strings
- [ ] Code blocks (curl, diffs) have light gray background fill
- [ ] All existing tests still pass

---

## Phase 3: Visual Polish (Optimization)

**Goal:** Upgrade typography, refine spacing, and add finishing touches.

### Task 3.1 — Acquire and embed fonts

**Directory:** `backend/assets/fonts/`

Download from Google Fonts (OFL-licensed):
- `Inter-Regular.ttf`
- `Inter-Bold.ttf`
- `Inter-SemiBold.ttf`
- `JetBrainsMono-Regular.ttf`

Total size: ~500KB. Add `backend/assets/` to the npm package files.

### Task 3.2 — Register fonts in PDF generator

**File:** `backend/src/reporting/pdf.ts`

At the top of `generatePdfReport`, register the custom fonts:

```typescript
import path from 'path';

const FONTS_DIR = path.join(__dirname, '../../assets/fonts');

// Inside generatePdfReport, after creating doc:
doc.registerFont('Inter', path.join(FONTS_DIR, 'Inter-Regular.ttf'));
doc.registerFont('Inter-Bold', path.join(FONTS_DIR, 'Inter-Bold.ttf'));
doc.registerFont('Inter-SemiBold', path.join(FONTS_DIR, 'Inter-SemiBold.ttf'));
doc.registerFont('JetBrains', path.join(FONTS_DIR, 'JetBrainsMono-Regular.ttf'));
```

Then replace all occurrences:
- `'Helvetica'` → `'Inter'`
- `'Helvetica-Bold'` → `'Inter-Bold'`
- `'Courier'` → `'JetBrains'`

Use `'Inter-SemiBold'` for finding titles and metadata labels (previously `'Helvetica-Bold'` at small sizes).

### Task 3.3 — Establish type scale

Replace ad-hoc font sizes with a disciplined scale:

| Element | Font | Size | Use |
|:---|:---|:---|:---|
| Title ("DISPATCH") | Inter-Bold | 24pt | Page 1 title banner |
| Section headers | Inter-Bold | 14pt | "Critical & High Severity Findings" |
| Finding title | Inter-SemiBold | 11pt | `#1 SQL INJECTION` |
| Subsection labels | Inter-SemiBold | 9pt | "Reproduction", "Recommended Fix" |
| Body text | Inter | 9pt | Descriptions, fix text |
| Metadata | Inter | 8pt | CVSS, OWASP, confidence |
| Code / file paths | JetBrains | 8pt | Curl commands, diffs, `file:line` |
| Footer | Inter | 7pt | "Dispatch — dispatch-run-9c3ad" |

### Task 3.4 — Improve diff rendering

**File:** `backend/src/reporting/pdf.ts`, function `drawFindingFull`

Currently diffs use tiny 6pt Courier (line 268). Upgrade:
- Use `JetBrains` at 7.5pt
- Add line-level background colors: `#DCFCE7` (green tint) for `+` lines, `#FEE2E2` (red tint) for `-` lines, `#F3F4F6` (gray) for context lines
- Render each line as a filled rect behind the text:

```typescript
for (const line of diffLines) {
  const lineHeight = 10;
  let bgColor = '#F3F4F6';
  let textColor = COLORS.muted;

  if (line.startsWith('+')) { bgColor = '#DCFCE7'; textColor = '#16A34A'; }
  else if (line.startsWith('-')) { bgColor = '#FEE2E2'; textColor = '#DC2626'; }

  doc.rect(x + 10, doc.y, pageWidth - 20, lineHeight).fill(bgColor);
  doc.font('JetBrains').fontSize(7.5).fillColor(textColor);
  doc.text(line, x + 14, doc.y + 1, { width: pageWidth - 28 });
  doc.y += lineHeight;
}
```

### Task 3.5 — Refine DISPATCH branding

**File:** `backend/src/reporting/pdf.ts`, function `drawExecutiveSummary`

Keep the dark navy banner but improve it:
- Increase banner height from 60px to 70px
- "DISPATCH" in Inter-Bold 28pt (up from 24pt) with letter-spacing
- Subtitle: "Security Scan Report" in Inter 11pt, `#C4B5FD` (keep current lavender)
- Add a thin accent line (2px, `#7C3AED` purple) below the banner

### Phase 3 — Done Criteria

- [ ] PDF renders with Inter and JetBrains Mono fonts (no Helvetica/Courier fallback)
- [ ] All text sizes follow the type scale table
- [ ] Diff blocks show colored line-level backgrounds
- [ ] DISPATCH banner is visually refined
- [ ] Font files are included in `backend/assets/fonts/` and load correctly in tests
- [ ] PDF file size increase is < 600KB (font embedding overhead)

---

## Risk / Mitigation Table

| Risk | Impact | Mitigation |
|:---|:---|:---|
| Default branch is `master`, not `main` — GitHub file URLs 404 | Medium | Task 1.5 captures commit SHA as `githubRef`. SHA-based URLs never break regardless of branch naming. Fall back to `main` only if SHA capture fails. |
| Line number `0` in findings — `#L0` is a meaningless anchor | Low | `githubFileUrl` helper omits fragment when `line <= 0` (Task 1.3). |
| Long file paths overflow PDF column width | Low | Truncate display to last 3 path segments (`…/dir/file.ts:42`), keep full path in URL. |
| PDFKit `{ link }` rendering differs across PDF viewers | Medium | Test in Chrome PDF viewer, Preview.app, and Adobe Reader. Links are a standard PDF annotation — broad support expected. |
| Custom font files not found at runtime (wrong `__dirname` after compilation) | High | Use `path.resolve(__dirname, '../../assets/fonts')` and add an existence check with fallback to built-in Helvetica/Courier. Add a CI test that verifies font loading. |
| `createdIssues` map is empty when GitHub issue creation fails | Low | Already handled — `options.createdIssues` is undefined or empty, and finding cards simply omit the issue badge. No code path depends on issues existing. |
| `heightOfString` inaccuracy for content-aware page breaks | Low | Use conservative height estimates (add 20% padding). Worst case: a finding splits across pages, which is the current behavior anyway. |

---

## Impacted Files

| File | Change Type | Phase |
|:---|:---|:---|
| `backend/src/reporting/pdf.ts` | Major rewrite | 1, 2, 3 |
| `backend/src/reporting/__tests__/pdf.test.ts` | Test additions + updates | 1, 2, 3 |
| `backend/src/cli.ts` | Thread options to PDF, add `--repo`/`--ref` flags | 1 |
| `backend/src/orchestrator/agent.ts` | Capture git SHA, add to result | 1 |
| `backend/src/github/types.ts` | No changes (types already sufficient) | — |
| `backend/src/orchestrator/collector.ts` | No changes | — |
| `backend/src/schemas/finding-report.ts` | No changes | — |
| `backend/assets/fonts/` (new directory) | Add TTF font files | 3 |

---

## Suggested Tests

### Phase 1 Tests (`pdf.test.ts`)

```
test: generatePdfReport accepts optional PdfReportOptions
test: PDF contains GitHub file URLs when githubRepo is provided
test: PDF contains plain file paths when githubRepo is omitted
test: PDF renders issue badges when createdIssues map is provided
test: PDF renders without issue badges when createdIssues is empty
test: githubFileUrl omits #L fragment when line is 0
test: githubFileUrl includes #L fragment for positive line numbers
test: generatePdfReport is backward-compatible (no options argument)
```

### Phase 2 Tests (`pdf.test.ts`)

```
test: executive summary sections render in correct vertical order
test: single finding does not produce an empty page
test: finding summary table appears when findings exist
test: finding summary table is omitted when findings are empty
test: clean endpoints are grouped by route (no duplicate headers)
test: timestamps display in human-readable format
test: code blocks render with background fill
test: condensed findings show file:line on separate line from vuln type
```

### Phase 3 Tests (`pdf.test.ts`)

```
test: custom fonts load from assets directory
test: PDF uses Inter font family (not Helvetica)
test: PDF uses JetBrains Mono for code blocks (not Courier)
test: diff lines have colored backgrounds (green for +, red for -)
test: fallback to built-in fonts if custom fonts not found
```

### Integration Test (manual or CI)

```
test: end-to-end scan with --repo flag produces PDF with clickable GitHub links
test: PDF opens correctly in Chrome, Preview.app, Adobe Reader
test: linked URLs resolve to correct GitHub file and line
```

---

> **📝 COMMIT PROTOCOL — When implementation is complete, launch a `commit-architect` sub-agent instance (via the Task tool with `subagent_type="commit-architect"`) to analyze your changes and produce clean, atomic Conventional Commits. Do not write commits manually.**
