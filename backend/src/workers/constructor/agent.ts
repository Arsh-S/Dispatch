import { ConstructorBootstrap, FixResult } from './types.js';
import { parseIssueBody } from './parse.js';
import { applyFix } from './fix.js';
import { createFixPR } from './pr.js';
import { postFixReport } from './report.js';
import { getOctokit, parseRepo } from '../../github/client.js';

export async function runConstructionWorker(bootstrap: ConstructorBootstrap): Promise<FixResult> {
  const octokit = getOctokit();
  const { owner, repo } = parseRepo(bootstrap.github_issue.repo);

  console.log(`[Constructor ${bootstrap.construction_worker_id}] Starting fix for issue #${bootstrap.github_issue.number}`);

  try {
    // Step 1: Fetch and parse the GitHub issue
    const { data: issue } = await octokit.issues.get({
      owner, repo,
      issue_number: bootstrap.github_issue.number,
    });

    const parsed = parseIssueBody(issue.body || '');
    console.log(`[Constructor] Parsed: ${parsed.vuln_type} at ${parsed.location.file}:${parsed.location.line}`);

    // Step 2: Update issue label to fix:in-progress
    await updateFixLabel(owner, repo, bootstrap.github_issue.number, 'fix:in-progress');

    // Step 3: Apply fix
    const fixResult = await applyFix(parsed, bootstrap);

    // Step 4: Create PR if fix was applied
    if (fixResult.files_changed.length > 0) {
      const pr = await createFixPR(parsed, bootstrap, fixResult);
      fixResult.pr = pr;
    }

    // Step 5: Post fix report as issue comment
    await postFixReport(bootstrap, parsed, fixResult);

    // Step 6: Update issue label based on result
    const finalLabel = fixResult.status === 'fix_verified' ? 'fix:verified'
      : fixResult.status === 'fix_unverified' ? 'fix:unverified'
      : 'fix:failed';
    await updateFixLabel(owner, repo, bootstrap.github_issue.number, finalLabel);

    return fixResult;

  } catch (err: any) {
    console.error(`[Constructor] Error: ${err.message}`);

    const failResult: FixResult = {
      status: 'error',
      files_changed: [],
      notes: err.message,
    };

    try {
      await postFixReport(bootstrap, null as any, failResult);
      await updateFixLabel(owner, repo, bootstrap.github_issue.number, 'fix:failed');
    } catch { /* best-effort cleanup */ }

    return failResult;
  }
}

async function updateFixLabel(owner: string, repo: string, issueNumber: number, newLabel: string): Promise<void> {
  const octokit = getOctokit();

  // Remove existing fix: labels
  try {
    const { data: labels } = await octokit.issues.listLabelsOnIssue({ owner, repo, issue_number: issueNumber });
    for (const label of labels) {
      if (label.name.startsWith('fix:')) {
        await octokit.issues.removeLabel({ owner, repo, issue_number: issueNumber, name: label.name });
      }
    }
  } catch { /* label may not exist */ }

  // Add new label
  await octokit.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [newLabel] });
}
