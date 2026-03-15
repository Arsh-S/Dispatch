import { getLinearClient } from './client.js';
import type { FindingForIssue } from '../github/types.js';
import { formatBody, formatTitle } from '../github/issues.js';

export interface CreatedLinearIssue {
  id: string;
  identifier: string; // e.g. "DISP-123"
  url: string;
  title: string;
}

export async function createLinearIssueFromFinding(
  teamId: string,
  finding: FindingForIssue,
  dispatchFixUrl?: string,
  githubRepo?: string,
): Promise<CreatedLinearIssue> {
  const client = getLinearClient();
  const title = formatTitle(finding);
  let description = formatBody(finding, githubRepo ? { github_repo: githubRepo } : undefined);

  const payload = await client.createIssue({
    teamId,
    title,
    description,
  });

  if (!payload.success) {
    throw new Error('Failed to create Linear issue');
  }

  // payload.issue is a LinearFetch - await to get the Issue
  const issue = await payload.issue;
  if (!issue) {
    throw new Error('Failed to create Linear issue');
  }
  const identifier = issue.identifier ?? issue.id;

  // Append "Run Dispatch Fixer" link (C5 from plan) — update after creation so we have the identifier
  if (dispatchFixUrl && identifier) {
    const fixLink = `${dispatchFixUrl}?linear=${identifier}`;
    description += `\n\n---\n\n[🔧 Run Dispatch Fixer](${fixLink})`;
    await client.updateIssue(issue.id, { description });
  }

  const workspaceUrl = process.env.LINEAR_WORKSPACE_URL || 'https://linear.app';
  const url = `${workspaceUrl}/issue/${identifier}`;

  console.log(`[Linear] Created issue ${identifier}: ${title}`);

  return {
    id: issue.id,
    identifier,
    url,
    title,
  };
}

/** Try alternate identifier formats when lookup fails (e.g. DISP-13 → DIS-13) */
function getIdentifierFallbacks(id: string): string[] {
  const ids = [id];
  const match = id.match(/^([A-Z]+)-(\d+)$/i);
  if (match) {
    const [, prefix, num] = match;
    if (prefix.endsWith('P') && prefix.length > 1) {
      ids.push(`${prefix.slice(0, -1)}-${num}`);
    }
    if (prefix.length === 3 && !prefix.endsWith('P')) {
      ids.push(`${prefix}P-${num}`);
    }
  }
  return ids;
}

/**
 * Extract github_repo from a Linear/GitHub issue body metadata block.
 * Used when fixing Linear issues so we know which repo to target.
 */
export function parseGithubRepoFromIssueBody(body: string): string | null {
  const match = body.match(/github_repo:\s*([^\s\n]+)/);
  return match ? match[1].trim() : null;
}

export async function fetchLinearIssue(issueIdOrIdentifier: string): Promise<{ id: string; identifier: string; title: string; description: string }> {
  const client = getLinearClient();
  const toTry = getIdentifierFallbacks(issueIdOrIdentifier);
  let lastError: Error | null = null;

  for (const id of toTry) {
    try {
      const issue = await client.issue(id);
      if (issue) {
        return {
          id: issue.id,
          identifier: issue.identifier ?? issue.id,
          title: issue.title ?? '',
          description: issue.description ?? '',
        };
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error(`Linear issue not found: ${issueIdOrIdentifier}`);
}

export async function addLinearComment(issueId: string, body: string): Promise<void> {
  const client = getLinearClient();
  const payload = await client.createComment({ issueId, body });
  if (!payload.success) {
    throw new Error('Failed to add Linear comment');
  }
}

export async function updateLinearIssueState(issueId: string, stateId: string): Promise<void> {
  const client = getLinearClient();
  const payload = await client.updateIssue(issueId, { stateId });
  if (!payload.success) {
    throw new Error('Failed to update Linear issue state');
  }
}

export async function createLinearIssuesFromReport(
  teamId: string,
  findings: FindingForIssue[],
  dispatchFixUrl?: string,
  githubRepo?: string,
): Promise<CreatedLinearIssue[]> {
  const issues: CreatedLinearIssue[] = [];

  for (const finding of findings) {
    const issue = await createLinearIssueFromFinding(teamId, finding, dispatchFixUrl, githubRepo);
    issues.push(issue);
  }

  return issues;
}
