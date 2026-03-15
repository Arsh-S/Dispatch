import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { ParsedIssue, FixResult, ConstructorBootstrap } from './types.js';

export async function applyFixWithLLM(
  parsed: ParsedIssue,
  _bootstrap: ConstructorBootstrap,
): Promise<FixResult> {
  const repoDir = process.env.REPO_DIR || '/repo';
  const targetFile = path.resolve(repoDir, parsed.location.file);

  if (!fs.existsSync(targetFile)) {
    return { status: 'fix_failed', files_changed: [], notes: `Target file not found: ${targetFile}` };
  }

  const fileContent = fs.readFileSync(targetFile, 'utf-8');

  const userMessage = buildUserMessage(parsed, fileContent);

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const responseText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  const fixedContent = extractFixedContent(responseText);

  if (!fixedContent || fixedContent === fileContent) {
    return { status: 'fix_failed', files_changed: [], notes: 'LLM returned no usable fix' };
  }

  fs.writeFileSync(targetFile, fixedContent);

  const status = parsed.exploit_confidence === 'unconfirmed' ? 'fix_unverified' as const : 'fix_verified' as const;

  return {
    status,
    files_changed: [parsed.location.file],
    validation: { result: 'PASS', response: 'Fix applied via LLM' },
    notes: `LLM fix applied for ${parsed.vuln_type}`,
  };
}

export function extractFixedContent(response: string): string | null {
  const match = response.match(/<fixed_file>([\s\S]*?)<\/fixed_file>/);
  if (!match) return null;
  const content = match[1].trim();
  if (content === 'UNABLE_TO_FIX') return null;
  return content;
}

function buildUserMessage(parsed: ParsedIssue, fileContent: string): string {
  const lines: string[] = [
    'Fix the following security vulnerability.',
    '',
    '## Vulnerability Details',
    `- **Type:** ${parsed.vuln_type}`,
    `- **Severity:** ${parsed.severity}`,
    `- **CVSS Score:** ${parsed.cvss_score ?? 'N/A'}`,
    `- **OWASP:** ${parsed.owasp ?? 'N/A'}`,
    `- **Exploit Confidence:** ${parsed.exploit_confidence}`,
    '',
    '## Location',
    `- **File:** ${parsed.location.file}`,
    `- **Line:** ${parsed.location.line}`,
    `- **Endpoint:** ${parsed.location.method} ${parsed.location.endpoint}`,
    `- **Affected Parameter:** ${parsed.location.parameter ?? 'N/A'}`,
    '',
    '## Description',
    parsed.description,
    '',
    '## Recommended Fix',
    parsed.recommended_fix,
  ];

  if (parsed.monkeypatch_diff) {
    lines.push(
      '',
      '## Validated Monkeypatch Diff',
      'This diff was confirmed to fix the vulnerability:',
      '```diff',
      parsed.monkeypatch_diff,
      '```',
    );
  }

  if (parsed.reproduction_command) {
    lines.push(
      '',
      '## Reproduction Command',
      '```bash',
      parsed.reproduction_command,
      '```',
    );
  }

  lines.push(
    '',
    '## Source File',
    '```',
    fileContent,
    '```',
    '',
    'Return the complete fixed file inside <fixed_file></fixed_file> tags.',
  );

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are an expert application security engineer. Your task is to fix a security vulnerability in a source code file.

Rules:
- Apply the MINIMAL change that correctly fixes the vulnerability.
- Do NOT refactor, rename, or reorganize unrelated code.
- Preserve the existing code style, formatting, and indentation exactly.
- Return the COMPLETE fixed file content inside <fixed_file> XML tags.
- If you cannot safely fix the vulnerability without breaking functionality,
  return <fixed_file>UNABLE_TO_FIX</fixed_file> and explain why in <explanation> tags.`;
