import { ParsedIssue } from './types.js';

export function parseIssueBody(body: string): ParsedIssue {
  // Parse YAML metadata — supports ```yaml code block or --- frontmatter delimiters
  const frontmatterMatch = body.match(/```ya?ml\n([\s\S]*?)\n```/) || body.match(/---\n([\s\S]*?)\n---/);
  const metadata: Record<string, string> = {};

  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        metadata[key.trim()] = valueParts.join(':').trim();
      }
    }
  }

  // Parse location table
  const location = {
    file: extractTableValue(body, 'File') || '',
    line: parseInt(extractTableValue(body, 'Line') || '0'),
    endpoint: extractTableValue(body, 'Endpoint') || '',
    method: extractTableValue(body, 'Method') || '',
    parameter: extractTableValue(body, 'Affected Parameter') || undefined,
  };

  // Parse reproduction command
  const reproMatch = body.match(/```bash\n([\s\S]*?)\n```/);
  const reproCommand = reproMatch ? reproMatch[1].trim() : undefined;

  // Parse monkeypatch diff
  const diffMatch = body.match(/```diff\n([\s\S]*?)\n```/);
  const monkeypatchDiff = diffMatch ? diffMatch[1].trim() : undefined;

  // Parse recommended fix section
  const fixMatch = body.match(/## Recommended Fix\n\n([\s\S]*?)(?=\n---|\n## |$)/);
  const recommendedFix = fixMatch ? fixMatch[1].trim() : '';

  // Parse rules violated
  const rulesMatch = body.match(/## RULES\.md Violations\n\n([\s\S]*?)(?=\n---|\n## |$)/);
  const rulesViolated = rulesMatch
    ? rulesMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).replace(/`/g, '').trim())
    : [];

  return {
    dispatch_run_id: metadata.dispatch_run_id || '',
    dispatch_worker_id: metadata.dispatch_worker_id || '',
    severity: metadata.severity || 'MEDIUM',
    cvss_score: metadata.cvss_score ? parseFloat(metadata.cvss_score) : undefined,
    owasp: metadata.owasp || undefined,
    vuln_type: metadata.vuln_type || '',
    exploit_confidence: (metadata.exploit_confidence as 'confirmed' | 'unconfirmed') || 'unconfirmed',
    monkeypatch_status: (metadata.monkeypatch_status as 'validated' | 'failed' | 'not-attempted') || 'not-attempted',
    fix_status: metadata.fix_status || 'unfixed',
    location,
    description: extractSection(body, 'Description') || '',
    reproduction_command: reproCommand,
    monkeypatch_diff: monkeypatchDiff,
    recommended_fix: recommendedFix,
    rules_violated: rulesViolated,
  };
}

function extractTableValue(body: string, field: string): string | null {
  const regex = new RegExp(`\\*\\*${field}\\*\\*\\s*\\|\\s*\`?([^\`|\\n]+)\`?`);
  const match = body.match(regex);
  return match ? match[1].trim() : null;
}

function extractSection(body: string, heading: string): string | null {
  const regex = new RegExp(`\\*\\*${heading}:\\*\\*\\n([\\s\\S]*?)(?=\\n---|\\n\\*\\*|\\n## |$)`);
  const match = body.match(regex);
  return match ? match[1].trim() : null;
}
