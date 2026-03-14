import { getOctokit, parseRepo } from './client';
import { DispatchLabel } from './types';

// All Dispatch labels with their colors (hex without #)
export const DISPATCH_LABELS: DispatchLabel[] = [
  // Exploit confidence
  { name: 'exploit:confirmed', color: '0e8a16', description: 'Vulnerability confirmed via live exploit' },
  { name: 'exploit:unconfirmed', color: 'fbca04', description: 'Suspicious code pattern, not confirmed live' },

  // Monkeypatch status
  { name: 'monkeypatch:validated', color: '0e8a16', description: 'Monkeypatch applied and fix direction proven' },
  { name: 'monkeypatch:failed', color: 'b60205', description: 'Monkeypatch applied but fix did not work' },
  { name: 'monkeypatch:not-attempted', color: 'c2c2c2', description: 'No monkeypatch was attempted' },

  // Fix status
  { name: 'fix:unfixed', color: 'b60205', description: 'No fix has been attempted' },
  { name: 'fix:in-progress', color: '0075ca', description: 'Construction worker is working on a fix' },
  { name: 'fix:verified', color: '0e8a16', description: 'Fix applied and validated successfully' },
  { name: 'fix:unverified', color: 'e99695', description: 'Fix applied but validation inconclusive' },
  { name: 'fix:failed', color: '5c0000', description: 'Fix attempt failed' },

  // Severity
  { name: 'severity:critical', color: '5c0000', description: 'Critical severity vulnerability' },
  { name: 'severity:high', color: 'b60205', description: 'High severity vulnerability' },
  { name: 'severity:medium', color: 'e99695', description: 'Medium severity vulnerability' },
  { name: 'severity:low', color: 'fbca04', description: 'Low severity vulnerability' },

  // Dispatch metadata
  { name: 'dispatch', color: '6f42c1', description: 'Created by Dispatch security scanner' },
];

export async function bootstrapLabels(repoFullName: string): Promise<void> {
  const octokit = getOctokit();
  const { owner, repo } = parseRepo(repoFullName);

  // Get existing labels
  const { data: existingLabels } = await octokit.issues.listLabelsForRepo({
    owner,
    repo,
    per_page: 100,
  });

  const existingNames = new Set(existingLabels.map(l => l.name));

  for (const label of DISPATCH_LABELS) {
    if (existingNames.has(label.name)) {
      // Update color/description if needed
      await octokit.issues.updateLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    } else {
      await octokit.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    }
  }

  console.log(`[GitHub] Bootstrapped ${DISPATCH_LABELS.length} labels on ${repoFullName}`);
}
