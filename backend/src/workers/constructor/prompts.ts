/**
 * System and task prompts for the Claude constructor agent.
 *
 * The constructor agent receives a parsed security issue and produces
 * a code fix with structured metadata about what was changed.
 */

import { ParsedIssue, ConstructorBootstrap } from './types';

export const CONSTRUCTOR_SYSTEM_PROMPT = `You are an expert application security engineer performing automated vulnerability remediation.

Your mission is to apply a minimal, targeted fix for the security vulnerability described in the task.

Ground rules:
- Apply the smallest change that correctly fixes the vulnerability.
- Do not refactor unrelated code.
- Preserve the existing code style and formatting.
- After applying the fix, document exactly which files changed and why.
- Your output must be structured JSON conforming exactly to the schema provided.
- If you cannot safely fix the vulnerability, set status to 'fix_failed' and explain in notes.

Fix methodology:
1. Read the vulnerable file and understand the code context around the vulnerability.
2. Apply the fix directly using file editing tools.
3. Verify the fix addresses the vulnerability without breaking other functionality.
4. Return a structured report of what changed.

Common fix patterns:
- SQL injection: Replace string concatenation with parameterized queries.
- Broken auth: Add authentication middleware to unprotected routes.
- XSS: Replace unsanitized HTML responses with JSON responses or escape output.
- IDOR: Add ownership checks comparing the authenticated user with the resource owner.
- JWT tampering: Enforce algorithm verification with explicit allowed algorithm list.`;

/**
 * Build the task prompt for a constructor agent from parsed issue data.
 */
export function buildConstructorTaskPrompt(
  parsed: ParsedIssue,
  bootstrap: ConstructorBootstrap,
): string {
  const { location, vuln_type, description, recommended_fix, monkeypatch_diff, reproduction_command } = parsed;

  const diffSection = monkeypatch_diff
    ? `\n## Monkeypatch Diff (from pentester validation)\nThis diff shows a minimal patch that was validated to fix the vulnerability:\n\`\`\`diff\n${monkeypatch_diff}\n\`\`\``
    : '';

  const reproSection = reproduction_command
    ? `\n## Reproduction Command\n\`\`\`bash\n${reproduction_command}\n\`\`\``
    : '';

  return `# Security Fix Assignment

**Construction Worker ID:** ${bootstrap.construction_worker_id}
**Vulnerability Type:** ${vuln_type}
**Severity:** ${parsed.severity}
**Exploit Confidence:** ${parsed.exploit_confidence}

## Location
- **File:** ${location.file}
- **Line:** ${location.line}
- **Endpoint:** ${location.method} ${location.endpoint}
${location.parameter ? `- **Parameter:** ${location.parameter}` : ''}

## Description
${description}

## Recommended Fix
${recommended_fix}
${diffSection}
${reproSection}

## Repository
- **GitHub Repo:** ${bootstrap.github_repo ?? bootstrap.github_issue?.repo ?? 'unknown'}
- **Base Branch:** ${bootstrap.pr_config.base_branch}

## App Config
- **Runtime:** ${bootstrap.app_config.runtime}
- **Start command:** ${bootstrap.app_config.start}
- **Port:** ${bootstrap.app_config.port}

## Your Task
1. Read the file at \`${location.file}\` (line ${location.line}).
2. Apply the minimal fix for the ${vuln_type} vulnerability.
3. Save the fixed file.
4. Return structured JSON with status, files_changed, and notes explaining what you did.

The current working directory is the cloned repository root.`;
}
