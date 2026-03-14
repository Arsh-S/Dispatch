/**
 * Claude constructor worker.
 *
 * Delegates the actual code fix to a Claude Code agent subprocess while
 * keeping all plumbing (GitHub API calls, PR creation, Linear updates) in Node.js.
 *
 * This complements the existing runConstructionWorker() which uses a
 * deterministic regex-based fix strategy. The Claude mode uses an LLM agent
 * to understand and fix more complex vulnerability patterns.
 *
 * Node.js responsibilities (plumbing — unchanged):
 * - Fetch issue from GitHub or Linear
 * - Parse the issue body into ParsedIssue
 * - Create the fix PR on GitHub
 * - Post status comments on GitHub/Linear
 *
 * Claude agent responsibilities:
 * - Read the vulnerable file
 * - Apply the targeted fix
 * - Return a structured FixResult
 */

import { ConstructorBootstrap, ParsedIssue, FixResult, FixResultSchema } from './types';
import { parseIssueBody } from './parse';
import { createFixPR } from './pr';
import { postFixReport } from './report';
import { postFixReportToLinear } from './report-linear';
import { getOctokit, parseRepo } from '../../github/client';
import { fetchLinearIssue, addLinearComment } from '../../linear/issues';
import { normalizeBootstrap } from './agent';
import { runClaudeAgent } from '../../agent-adapters/claude-agent-runner';
import { CONSTRUCTOR_SYSTEM_PROMPT, buildConstructorTaskPrompt } from './prompts';

/**
 * Run the Claude constructor agent for a given issue.
 *
 * This function mirrors the structure of runConstructionWorker() but
 * delegates the fix step to Claude instead of the deterministic fix strategy.
 */
export async function runClaudeConstructionWorker(
  bootstrap: ConstructorBootstrap,
  /** Local path to the cloned repository where fixes should be applied. */
  repoDir: string,
): Promise<FixResult> {
  const b = normalizeBootstrap(bootstrap);
  const { owner, repo } = parseRepo(b.github_repo);

  const issueDesc = b.issue_source === 'linear'
    ? `Linear ${b.linear_issue!.id}`
    : `GitHub #${b.github_issue!.number}`;

  console.log(`[ClaudeConstructor ${b.construction_worker_id}] Starting Claude-mode fix for ${issueDesc}`);

  try {
    // Step 1: Fetch and parse the issue (plumbing — unchanged)
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

    const parsed = parseIssueBody(issueBody);
    console.log(`[ClaudeConstructor] Parsed: ${parsed.vuln_type} at ${parsed.location.file}:${parsed.location.line}`);

    // Step 2: Update issue status to in-progress (plumbing — unchanged)
    if (b.issue_source === 'linear' && linearIssueId) {
      await postLinearStatusComment(linearIssueId, 'fix:in-progress', b.construction_worker_id);
    } else if (b.github_issue) {
      await updateFixLabel(owner, repo, b.github_issue.number, 'fix:in-progress');
    }

    // Step 3: Invoke Claude agent to apply the fix
    const fixResult = await applyFixWithClaude(parsed, b, repoDir);

    // Step 4: Create PR if files changed (plumbing — unchanged)
    if (fixResult.files_changed.length > 0) {
      const pr = await createFixPR(parsed, b, fixResult);
      fixResult.pr = pr;
    }

    // Step 5: Post fix report (plumbing — unchanged)
    if (b.issue_source === 'linear' && linearIssueId) {
      await postFixReportToLinear(linearIssueId, b, parsed, fixResult);
      const statusLabel = fixResult.status === 'fix_verified' ? 'fix:verified'
        : fixResult.status === 'fix_unverified' ? 'fix:unverified'
        : 'fix:failed';
      await postLinearStatusComment(linearIssueId, statusLabel, b.construction_worker_id);
    } else if (b.github_issue) {
      await postFixReport(b, parsed, fixResult);
      const finalLabel = fixResult.status === 'fix_verified' ? 'fix:verified'
        : fixResult.status === 'fix_unverified' ? 'fix:unverified'
        : 'fix:failed';
      await updateFixLabel(owner, repo, b.github_issue.number, finalLabel);
    }

    return fixResult;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ClaudeConstructor] Error: ${message}`);

    const failResult: FixResult = {
      status: 'error',
      files_changed: [],
      notes: message,
    };

    try {
      if (b.issue_source === 'linear' && b.linear_issue) {
        const linear = await fetchLinearIssue(b.linear_issue.id);
        await postFixReportToLinear(linear.id, b, null as unknown as ParsedIssue, failResult);
      } else if (b.github_issue) {
        await postFixReport(b, null as unknown as ParsedIssue, failResult);
        await updateFixLabel(owner, repo, b.github_issue.number, 'fix:failed');
      }
    } catch { /* best-effort cleanup */ }

    return failResult;
  }
}

/**
 * Invoke the Claude Code agent to apply a security fix.
 * Claude reads the vulnerable file and applies the fix in the repoDir.
 */
async function applyFixWithClaude(
  parsed: ParsedIssue,
  bootstrap: ConstructorBootstrap,
  repoDir: string,
): Promise<FixResult> {
  const taskPrompt = buildConstructorTaskPrompt(parsed, bootstrap);

  console.log(`[ClaudeConstructor] Invoking Claude agent to fix ${parsed.vuln_type} in ${parsed.location.file}`);

  const agentResult = await runClaudeAgent({
    systemPrompt: CONSTRUCTOR_SYSTEM_PROMPT,
    taskPrompt,
    outputSchema: FixResultSchema,
    timeoutMs: bootstrap.timeout_seconds * 1000,
    cwd: repoDir,
  });

  if (!agentResult.success || !agentResult.data) {
    console.warn(`[ClaudeConstructor] Agent failed: ${agentResult.error}`);
    return {
      status: 'fix_failed',
      files_changed: [],
      notes: `Claude agent failed: ${agentResult.error ?? 'unknown error'}`,
    };
  }

  const raw = agentResult.data;
  console.log(`[ClaudeConstructor] Agent completed with status: ${raw.status}, files: ${raw.files_changed.join(', ')}`);

  // Map Zod schema output (nullable fields) to FixResult interface (optional/undefined fields)
  const result: FixResult = {
    status: raw.status,
    files_changed: raw.files_changed,
    notes: raw.notes,
    validation: raw.validation ?? undefined,
    pr: raw.pr ?? undefined,
  };
  return result;
}

// ---------------------------------------------------------------------------
// Helpers (mirrors the private helpers in agent.ts)
// ---------------------------------------------------------------------------

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
