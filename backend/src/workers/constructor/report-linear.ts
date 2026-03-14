import { addLinearComment } from '../../linear/issues.js';
import { ConstructorBootstrap, ParsedIssue, FixResult } from './types.js';
import { formatFixReport } from './report.js';

export async function postFixReportToLinear(
  issueId: string,
  bootstrap: ConstructorBootstrap,
  _parsed: ParsedIssue | null,
  fixResult: FixResult,
): Promise<void> {
  const body = formatFixReport(bootstrap, fixResult);
  await addLinearComment(issueId, body);
}
