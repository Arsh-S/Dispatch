import { execSync } from 'child_process';
import { getOctokit, parseRepo } from '../../github/client.js';
import { formatEndpointDisplay } from '../../github/issues.js';
import { ParsedIssue, FixResult, ConstructorBootstrap } from './types.js';
import { getMemoryStore, generateFindingFingerprint } from '../../memory/index.js';
import type { MemoryContextForPR, FindingHistoryEntry } from '../../memory/types.js';

/** Git author identity for Dispatch bot — commits appear as "Dispatch Agent" instead of the token owner */
function getDispatchGitEnv(): Record<string, string> {
  const name = process.env.DISPATCH_GIT_AUTHOR_NAME ?? 'Dispatch Agent';
  const email = process.env.DISPATCH_GIT_AUTHOR_EMAIL ?? 'dispatch-agent@dispatch.ai';
  return {
    ...process.env,
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email,
  };
}

export async function createFixPR(
  parsed: ParsedIssue,
  bootstrap: ConstructorBootstrap,
  fixResult: FixResult,
): Promise<{ number: number; url: string; branch: string }> {
  const octokit = getOctokit();
  const repoFull = bootstrap.github_repo ?? bootstrap.github_issue?.repo;
  if (!repoFull) throw new Error('github_repo required for PR');
  const { owner, repo } = parseRepo(repoFull);
  const issueNumber = bootstrap.github_issue?.number;
  const issueRef = issueNumber ?? bootstrap.linear_issue?.id ?? 'fix';
  const shortId = bootstrap.construction_worker_id.replace(/[^a-z0-9]/gi, '').slice(-8);

  // Branch name — include short unique suffix to avoid push conflicts when re-running fixes
  const vulnSlug = parsed.vuln_type.toLowerCase().replace(/\s+/g, '-');
  const endpointDisplay = formatEndpointDisplay(parsed.location);
  const endpointSlug = parsed.location.endpoint.split('/').pop() || 'unknown';
  const branch = `${bootstrap.pr_config.branch_prefix}-${vulnSlug}-${endpointSlug}-${issueRef}-${shortId}`;

  // Create branch and commit
  const cwd = process.env.REPO_DIR || process.cwd();
  const fixesLine = issueNumber ? `\n\nFixes #${issueNumber}` : '';
  const gitEnv = getDispatchGitEnv();
  execSync(`git checkout -b ${branch}`, { cwd, stdio: 'pipe' });
  execSync(`git add -A`, { cwd, stdio: 'pipe' });
  execSync(
    `git commit -m "fix(${vulnSlug}): resolve ${parsed.vuln_type} in ${endpointDisplay}${fixesLine}"`,
    { cwd, stdio: 'pipe', env: gitEnv },
  );
  execSync(`git push -u origin ${branch}`, { cwd, stdio: 'pipe' });

  // Fetch memory context for PR enrichment
  const memoryContext = await fetchMemoryContextForPR(bootstrap, parsed);

  // Create PR
  const prTitle = `[Dispatch] Fix ${parsed.vuln_type} in ${endpointDisplay}`;
  const prBody = formatPRBody(parsed, fixResult, issueNumber, memoryContext);

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: prTitle,
    body: prBody,
    head: branch,
    base: bootstrap.pr_config.base_branch,
  });

  // Switch back to base branch
  execSync(`git checkout ${bootstrap.pr_config.base_branch}`, { cwd, stdio: 'pipe' });

  console.log(`[Constructor PR] Created PR #${pr.number}: ${pr.html_url}`);

  return { number: pr.number, url: pr.html_url, branch };
}

async function fetchMemoryContextForPR(
  bootstrap: ConstructorBootstrap,
  parsed: ParsedIssue,
): Promise<MemoryContextForPR | null> {
  try {
    const store = getMemoryStore();
    if (!store) return null;

    const targetId = bootstrap.github_repo ?? bootstrap.github_issue?.repo;
    if (!targetId) return null;

    const fingerprint = generateFindingFingerprint({
      location: { endpoint: parsed.location.endpoint, parameter: parsed.location.parameter },
      vuln_type: parsed.vuln_type,
    });

    const [history, consecutiveCounts] = await Promise.all([
      store.getHistoryForFinding(targetId, fingerprint, 10),
      store.getConsecutiveCounts(targetId, [fingerprint]),
    ]);

    if (history.length === 0) return null;

    return {
      consecutiveCount: consecutiveCounts.get(fingerprint) ?? 0,
      history,
      escalatedFrom: parsed.escalated_from,
    };
  } catch (e) {
    console.warn('[Constructor PR] Memory context fetch failed (continuing without):', e);
    return null;
  }
}

function formatScanHistoryTable(history: FindingHistoryEntry[], consecutiveCount: number): string {
  const rows = history.map(h => `| ${h.run_id} | ${h.completed_at.slice(0, 10)} | ${h.severity} |`).join('\n');
  return `## Scan History

| Run | Date | Severity |
|-----|------|----------|
${rows}

> This endpoint has been flagged in **${consecutiveCount} consecutive scans**. Severity was escalated to prioritize remediation.
`;
}

function formatPRBody(
  parsed: ParsedIssue,
  fixResult: FixResult,
  issueNumber?: number,
  memoryContext?: MemoryContextForPR | null,
): string {
  const issueRef = issueNumber ? `**Issue:** #${issueNumber}\n` : '';
  const fixesLine = issueNumber ? `\nFixes #${issueNumber}` : '';

  const severityLine = memoryContext?.escalatedFrom
    ? `**Vulnerability:** ${parsed.vuln_type} — ${parsed.severity} *(escalated from ${memoryContext.escalatedFrom} — flagged in ${memoryContext.consecutiveCount} consecutive scans)*`
    : `**Vulnerability:** ${parsed.vuln_type} — ${parsed.severity}`;

  const scanHistorySection = memoryContext && memoryContext.history.length >= 2
    ? formatScanHistoryTable(memoryContext.history, memoryContext.consecutiveCount)
    : '';

  return `## Dispatch Automated Fix

${issueRef}${severityLine}
**Location:** \`${parsed.location.file}:${parsed.location.line}\`

${scanHistorySection}
## What Changed

${fixResult.files_changed.map(f => `- \`${f}\``).join('\n')}

${fixResult.notes}

## Validation

${fixResult.validation ? `**Result:** ${fixResult.validation.result} — ${fixResult.validation.response}` : 'No validation performed.'}

${parsed.reproduction_command ? `### Reproduction Command\n\`\`\`bash\n${parsed.reproduction_command}\n\`\`\`` : ''}

---
*Automated fix by Dispatch. Review before merging.*${fixesLine}`;
}
