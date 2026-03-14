import { execSync } from 'child_process';
import { getOctokit, parseRepo } from '../../github/client.js';
import { ParsedIssue, FixResult, ConstructorBootstrap } from './types.js';

export async function createFixPR(
  parsed: ParsedIssue,
  bootstrap: ConstructorBootstrap,
  fixResult: FixResult,
): Promise<{ number: number; url: string; branch: string }> {
  const octokit = getOctokit();
  const { owner, repo } = parseRepo(bootstrap.github_issue.repo);
  const issueNumber = bootstrap.github_issue.number;

  // Branch name
  const vulnSlug = parsed.vuln_type.toLowerCase().replace(/\s+/g, '-');
  const endpointSlug = parsed.location.endpoint.split('/').pop() || 'unknown';
  const branch = `${bootstrap.pr_config.branch_prefix}-${vulnSlug}-${endpointSlug}-${issueNumber}`;

  // Create branch and commit
  const cwd = process.cwd();
  execSync(`git checkout -b ${branch}`, { cwd, stdio: 'pipe' });
  execSync(`git add -A`, { cwd, stdio: 'pipe' });
  execSync(
    `git commit -m "fix(${vulnSlug}): resolve ${parsed.vuln_type} in ${parsed.location.method} ${parsed.location.endpoint}\n\nFixes #${issueNumber}"`,
    { cwd, stdio: 'pipe' },
  );
  execSync(`git push -u origin ${branch}`, { cwd, stdio: 'pipe' });

  // Create PR
  const prTitle = `[Dispatch] Fix ${parsed.vuln_type} in ${parsed.location.method} ${parsed.location.endpoint}`;
  const prBody = formatPRBody(parsed, fixResult, issueNumber);

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

function formatPRBody(parsed: ParsedIssue, fixResult: FixResult, issueNumber: number): string {
  return `## Dispatch Automated Fix

**Issue:** #${issueNumber}
**Vulnerability:** ${parsed.vuln_type} — ${parsed.severity}
**Location:** \`${parsed.location.file}:${parsed.location.line}\`

## What Changed

${fixResult.files_changed.map(f => `- \`${f}\``).join('\n')}

${fixResult.notes}

## Validation

${fixResult.validation ? `**Result:** ${fixResult.validation.result} — ${fixResult.validation.response}` : 'No validation performed.'}

${parsed.reproduction_command ? `### Reproduction Command\n\`\`\`bash\n${parsed.reproduction_command}\n\`\`\`` : ''}

---
*Automated fix by Dispatch. Review before merging.*

Fixes #${issueNumber}`;
}
