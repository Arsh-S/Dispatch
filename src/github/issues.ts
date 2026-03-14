import { getOctokit, parseRepo } from './client';
import { FindingForIssue, CreatedIssue } from './types';

export async function createIssueFromFinding(
  repoFullName: string,
  finding: FindingForIssue,
): Promise<CreatedIssue> {
  const octokit = getOctokit();
  const { owner, repo } = parseRepo(repoFullName);

  const title = formatTitle(finding);
  const body = formatBody(finding);
  const labels = getLabels(finding);

  const { data: issue } = await octokit.issues.create({
    owner,
    repo,
    title,
    body,
    labels,
  });

  console.log(`[GitHub] Created issue #${issue.number}: ${title}`);

  return {
    number: issue.number,
    url: issue.html_url,
    title,
  };
}

export function formatTitle(finding: FindingForIssue): string {
  const severity = finding.severity;
  const vulnType = finding.vuln_type
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const endpoint = `${finding.location.method} ${finding.location.endpoint}`;
  const desc = finding.description.split('.')[0]; // First sentence

  return `[${severity}] ${vulnType}: ${endpoint} — ${desc.length > 60 ? desc.substring(0, 57) + '...' : desc}`;
}

export function formatBody(finding: FindingForIssue): string {
  const sections: string[] = [];

  // Metadata block
  sections.push(`---
dispatch_run_id: ${finding.dispatch_run_id}
dispatch_worker_id: ${finding.dispatch_worker_id}
timestamp: ${finding.timestamp}
severity: ${finding.severity}
${finding.cvss_score ? `cvss_score: ${finding.cvss_score}` : ''}
${finding.owasp ? `owasp: ${finding.owasp}` : ''}
vuln_type: ${finding.vuln_type}
exploit_confidence: ${finding.exploit_confidence}
monkeypatch_status: ${finding.monkeypatch_status}
fix_status: ${finding.fix_status}
---`);

  // Vulnerability section
  sections.push(`## Vulnerability

| Field | Value |
|---|---|
| **File** | \`${finding.location.file}\` |
| **Line** | ${finding.location.line} |
| **Endpoint** | \`${finding.location.endpoint}\` |
| **Method** | ${finding.location.method} |
${finding.location.parameter ? `| **Affected Parameter** | \`${finding.location.parameter}\` |` : ''}

**Description:**
${finding.description}`);

  // Reproduction section
  if (finding.reproduction) {
    const steps = finding.reproduction.steps
      ? finding.reproduction.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : '';

    sections.push(`## Reproduction

${steps}

\`\`\`bash
${finding.reproduction.command}
\`\`\`

**Expected behavior:** ${finding.reproduction.expected}
**Actual behavior:** ${finding.reproduction.actual}`);
  }

  // Server logs
  if (finding.server_logs && finding.server_logs.length > 0) {
    const logLines = finding.server_logs
      .map(l => `[${l.timestamp}] ${l.level}  ${l.message}`)
      .join('\n');

    sections.push(`## Server Logs

\`\`\`
${logLines}
\`\`\``);
  }

  // Monkeypatch section
  if (finding.monkeypatch) {
    sections.push(`## Monkeypatch

**Status:** \`${finding.monkeypatch.status}\``);

    if (finding.monkeypatch.diff) {
      sections.push(`\`\`\`diff
${finding.monkeypatch.diff}
\`\`\``);
    }

    if (finding.monkeypatch.validation) {
      sections.push(`### Validation

| Field | Value |
|---|---|
| **Test** | ${finding.monkeypatch.validation.test} |
| **Result** | ${finding.monkeypatch.validation.result} |
${finding.monkeypatch.validation.response ? `| **Response** | ${finding.monkeypatch.validation.response} |` : ''}
${finding.monkeypatch.validation.side_effects ? `| **Side effects** | ${finding.monkeypatch.validation.side_effects} |` : ''}`);
    }

    if (finding.monkeypatch.post_patch_logs && finding.monkeypatch.post_patch_logs.length > 0) {
      const postLogLines = finding.monkeypatch.post_patch_logs
        .map(l => `[${l.timestamp}] ${l.level}  ${l.message}`)
        .join('\n');
      sections.push(`**Post-patch server logs:**

\`\`\`
${postLogLines}
\`\`\``);
    }
  }

  // Recommended fix
  sections.push(`## Recommended Fix

${finding.recommended_fix}`);

  // Rules violated
  if (finding.rules_violated.length > 0) {
    sections.push(`## RULES.md Violations

${finding.rules_violated.map(r => `- \`${r}\``).join('\n')}`);
  }

  return sections.join('\n\n---\n\n');
}

export function getLabels(finding: FindingForIssue): string[] {
  const labels: string[] = ['dispatch'];

  // Axis 1: Exploit confidence
  labels.push(`exploit:${finding.exploit_confidence}`);

  // Axis 2: Monkeypatch status
  labels.push(`monkeypatch:${finding.monkeypatch_status}`);

  // Axis 3: Fix status
  labels.push(`fix:${finding.fix_status || 'unfixed'}`);

  // Axis 4: Classification
  labels.push(`severity:${finding.severity.toLowerCase()}`);
  labels.push(`vuln:${finding.vuln_type}`);
  if (finding.owasp) {
    labels.push(`owasp:${finding.owasp.replace(':', '-').replace(' ', '-')}`);
  }

  // Axis 5: Dispatch metadata
  labels.push(`dispatch-run:${finding.dispatch_run_id.replace('dispatch-run-', '')}`);
  labels.push(`dispatch-worker:${finding.dispatch_worker_id}`);

  return labels;
}

export async function createIssuesFromReport(
  repoFullName: string,
  findings: FindingForIssue[],
): Promise<CreatedIssue[]> {
  const issues: CreatedIssue[] = [];

  for (const finding of findings) {
    const issue = await createIssueFromFinding(repoFullName, finding);
    issues.push(issue);
  }

  return issues;
}
