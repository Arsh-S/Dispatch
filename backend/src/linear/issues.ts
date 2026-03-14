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
): Promise<CreatedLinearIssue> {
  const client = getLinearClient();
  const title = formatTitle(finding);
  let description = formatBody(finding);

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

export async function fetchLinearIssue(issueIdOrIdentifier: string): Promise<{ id: string; identifier: string; title: string; description: string }> {
  const client = getLinearClient();
  const issue = await client.issue(issueIdOrIdentifier);
  if (!issue) {
    throw new Error(`Linear issue not found: ${issueIdOrIdentifier}`);
  }
  return {
    id: issue.id,
    identifier: issue.identifier ?? issue.id,
    title: issue.title ?? '',
    description: issue.description ?? '',
  };
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
): Promise<CreatedLinearIssue[]> {
  const issues: CreatedLinearIssue[] = [];

  for (const finding of findings) {
    const issue = await createLinearIssueFromFinding(teamId, finding, dispatchFixUrl);
    issues.push(issue);
  }

  return issues;
}
