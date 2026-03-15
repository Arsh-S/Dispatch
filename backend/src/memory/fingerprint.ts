import crypto from 'crypto';

export function generateFindingFingerprint(finding: {
  location: { endpoint: string; parameter?: string | null };
  vuln_type: string;
}): string {
  const raw = `${finding.location.endpoint}:${finding.location.parameter || ''}:${finding.vuln_type}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}
