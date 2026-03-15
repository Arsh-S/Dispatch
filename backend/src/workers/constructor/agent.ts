import path from 'path';
import os from 'os';
import { ConstructorBootstrap, FixResult } from './types.js';
import { parseIssueBody } from './parse.js';
import { applyFix } from './fix.js';
import { createFixPR } from './pr.js';
import { postFixReport } from './report.js';
import { postFixReportToLinear } from './report-linear.js';
import { getOctokit, parseRepo } from '../../github/client.js';
import { fetchLinearIssue, addLinearComment, updateLinearIssueState } from '../../linear/issues.js';
import { DiagnosticsAccumulator } from '../../diagnostics/accumulator.js';

/** Normalize bootstrap: resolve issue_source and github_repo from legacy or explicit format */
export function normalizeBootstrap(b: ConstructorBootstrap): Required<Pick<ConstructorBootstrap, 'issue_source' | 'github_repo'>> & ConstructorBootstrap {
  const issue_source = b.issue_source ?? (b.github_issue ? 'github' : b.linear_issue ? 'linear' : 'github');
  const github_repo = b.github_repo ?? (b.github_issue?.repo ?? '');
  if (!github_repo) {
    throw new Error('github_repo is required (or provide github_issue.repo when using GitHub source)');
  }
  return { ...b, issue_source, github_repo };
}

export async function runConstructionWorker(bootstrap: ConstructorBootstrap): Promise<FixResult> {
  const b = normalizeBootstrap(bootstrap);
  const { owner, repo } = parseRepo(b.github_repo);

  const issueDesc = b.issue_source === 'linear'
    ? `Linear ${b.linear_issue!.id}`
    : `GitHub #${b.github_issue!.number}`;
  console.log(`[Constructor ${b.construction_worker_id}] Starting fix for ${issueDesc}`);

  // Diagnostics accumulator
  const diagDir = path.join(os.tmpdir(), 'dispatch', b.construction_worker_id);
  const diagPath = path.join(diagDir, 'diagnostics.json');
  const diagnostics = new DiagnosticsAccumulator(
    b.construction_worker_id,
    'constructor',
    `constructor-run-${Date.now()}`,
    diagPath,
  );
  diagnostics.setPhase('init');
  diagnostics.setLastAction(`Starting fix for ${issueDesc}`);

  try {
    // Step 1: Fetch and parse the issue (from GitHub or Linear)
    let issueBody: string;
    let linearIssueId: string | undefined;

    if (b.issue_source === 'linear' && b.linear_issue) {
      const linear = await fetchLinearIssue(b.linear_issue.id);
      issueBody = linear.description;
      linearIssueId = linear.id;
    } else if (b.github_issue) {
      const octokit = getOctokit();
      const { data: issue } = await octokit.issues.get({
        owner, repo,
        issue_number: b.github_issue.number,
      });
      issueBody = issue.body || '';
    } else {
      throw new Error('No issue source: provide github_issue or linear_issue');
    }

    diagnostics.recordToolCall('fetchIssue');
    const parsed = parseIssueBody(issueBody);
    diagnostics.setPhase('parsed');
    diagnostics.setLastAction(`Parsed: ${parsed.vuln_type} at ${parsed.location.file}:${parsed.location.line}`);
    console.log(`[Constructor] Parsed: ${parsed.vuln_type} at ${parsed.location.file}:${parsed.location.line}`);

    // Step 2: Update issue status to in-progress
    if (b.issue_source === 'linear' && linearIssueId) {
      await postLinearStatusComment(linearIssueId, 'fix:in-progress', b.construction_worker_id);
    } else if (b.github_issue) {
      await updateFixLabel(owner, repo, b.github_issue.number, 'fix:in-progress');
    }

    // Step 3: Apply fix
    diagnostics.setPhase('fix');
    diagnostics.setLastAction('Applying fix');
    diagnostics.recordToolCall('applyFix');
    const fixResult = await applyFix(parsed, b);

    // Step 4: Create PR if fix was applied (always on GitHub)
    for (const f of fixResult.files_changed) {
      diagnostics.recordFileTouch(f);
    }
    if (fixResult.files_changed.length > 0) {
      diagnostics.setPhase('pr');
      diagnostics.setLastAction('Creating fix PR');
      diagnostics.recordToolCall('createFixPR');
      const pr = await createFixPR(parsed, b, fixResult);
      fixResult.pr = pr;
    }

    // Step 5: Post fix report
    diagnostics.setPhase('reporting');
    diagnostics.setLastAction('Posting fix report');
    diagnostics.recordToolCall('postFixReport');
    if (b.issue_source === 'linear' && linearIssueId) {
      await postFixReportToLinear(linearIssueId, b, parsed, fixResult);
      await postLinearStatusComment(linearIssueId, fixResult.status === 'fix_verified' ? 'fix:verified' : fixResult.status === 'fix_unverified' ? 'fix:unverified' : 'fix:failed', b.construction_worker_id);
    } else if (b.github_issue) {
      await postFixReport(b, parsed, fixResult);
      const finalLabel = fixResult.status === 'fix_verified' ? 'fix:verified'
        : fixResult.status === 'fix_unverified' ? 'fix:unverified'
        : 'fix:failed';
      await updateFixLabel(owner, repo, b.github_issue.number, finalLabel);
    }

    diagnostics.setPhase('complete');
    diagnostics.setLastAction(`Fix ${fixResult.status}`);
    diagnostics.stop();

    return fixResult;

  } catch (err: any) {
    console.error(`[Constructor] Error: ${err.message}`);
    diagnostics.recordError();
    diagnostics.setPhase('error');
    diagnostics.setLastAction(`Error: ${err.message}`);
    diagnostics.stop();

    const failResult: FixResult = {
      status: 'error',
      files_changed: [],
      notes: err.message,
    };

    try {
      if (b.issue_source === 'linear' && b.linear_issue) {
        const linear = await fetchLinearIssue(b.linear_issue.id);
        await postFixReportToLinear(linear.id, b, null as any, failResult);
      } else if (b.github_issue) {
        await postFixReport(b, null as any, failResult);
        await updateFixLabel(owner, repo, b.github_issue.number, 'fix:failed');
      }
    } catch { /* best-effort cleanup */ }

    return failResult;
  }
}

async function postLinearStatusComment(issueId: string, status: string, workerId: string): Promise<void> {
  await addLinearComment(issueId, `**Dispatch:** ${status} (worker: ${workerId})`);
}

async function updateFixLabel(owner: string, repo: string, issueNumber: number, newLabel: string): Promise<void> {
  const octokit = getOctokit();

  try {
    const { data: labels } = await octokit.issues.listLabelsOnIssue({ owner, repo, issue_number: issueNumber });
    for (const label of labels) {
      if (label.name.startsWith('fix:')) {
        await octokit.issues.removeLabel({ owner, repo, issue_number: issueNumber, name: label.name });
      }
    }
  } catch { /* label may not exist */ }

  await octokit.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [newLabel] });
}
