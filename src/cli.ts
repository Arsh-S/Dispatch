import { runOrchestrator } from './orchestrator/agent';
import { bootstrapLabels } from './github/labels';
import { createIssuesFromReport } from './github/issues';
import { FindingForIssue } from './github/types';
import { Finding } from './schemas/finding-report';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'scan') {
    const targetPath = args[1];
    if (!targetPath) {
      console.error('Usage: pnpm tsx src/cli.ts scan <path-to-repo>');
      process.exit(1);
    }

    const targetDir = path.resolve(targetPath);
    if (!fs.existsSync(targetDir)) {
      console.error(`Target directory not found: ${targetDir}`);
      process.exit(1);
    }

    const githubRepo = args[2] || process.env.GITHUB_REPO; // optional: owner/repo for issue creation
    const outputPath = path.join(process.cwd(), 'dispatch-output.json');

    console.log('=== Dispatch Security Scanner ===');
    console.log(`Target: ${targetDir}`);
    console.log(`Output: ${outputPath}`);
    if (githubRepo) console.log(`GitHub: ${githubRepo}`);
    console.log('');

    // Run orchestrator
    const result = await runOrchestrator({
      targetDir,
      mode: 'local',
      maxWorkers: 2,
      outputPath,
    });

    console.log('\n=== Scan Results ===');
    console.log(`Routes found: ${result.preRecon.route_map.length}`);
    console.log(`Risk signals: ${result.preRecon.risk_signals.length}`);
    console.log(`Workers dispatched: ${result.assignments.length}`);

    if (result.mergedReport) {
      const report = result.mergedReport;
      console.log(`\nFindings: ${report.findings.length}`);
      console.log(`  Critical: ${report.summary.critical}`);
      console.log(`  High: ${report.summary.high}`);
      console.log(`  Medium: ${report.summary.medium}`);
      console.log(`  Low: ${report.summary.low}`);

      // Create GitHub Issues if repo specified
      if (githubRepo && report.findings.length > 0) {
        console.log(`\nCreating GitHub Issues on ${githubRepo}...`);
        try {
          await bootstrapLabels(githubRepo);
          const issueFindings = report.findings.map(f => convertToIssueFormat(f, result.preRecon.dispatch_run_id));
          const issues = await createIssuesFromReport(githubRepo, issueFindings);
          console.log(`Created ${issues.length} issues:`);
          issues.forEach(i => console.log(`  #${i.number}: ${i.title} — ${i.url}`));
        } catch (err: any) {
          console.error(`GitHub issue creation failed: ${err.message}`);
        }
      }

      // Also copy output to dashboard public dir
      const dashboardOutput = path.join(__dirname, 'dashboard/public/dispatch-output.json');
      try {
        fs.copyFileSync(outputPath, dashboardOutput);
        console.log(`\nDashboard data updated. Run: cd src/dashboard && pnpm dev`);
      } catch {
        // Dashboard dir may not exist yet
      }

      console.log(`\nFull report: ${outputPath}`);
    } else {
      console.log('\nNo findings collected. Workers may have encountered errors.');
      result.workerResults.forEach(w => {
        if (w.error) console.log(`  ${w.workerId}: ${w.error}`);
      });
    }
  } else {
    console.log('Dispatch Security Scanner');
    console.log('');
    console.log('Usage:');
    console.log('  pnpm tsx src/cli.ts scan <path-to-repo> [owner/repo]');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm tsx src/cli.ts scan ./sample-app');
    console.log('  pnpm tsx src/cli.ts scan ./sample-app myorg/myrepo');
  }
}

function convertToIssueFormat(finding: Finding, dispatchRunId: string): FindingForIssue {
  return {
    dispatch_run_id: dispatchRunId,
    dispatch_worker_id: finding.finding_id, // Use finding ID as worker ref
    timestamp: new Date().toISOString(),
    severity: finding.severity,
    cvss_score: finding.cvss_score,
    owasp: finding.owasp,
    vuln_type: finding.vuln_type,
    exploit_confidence: finding.exploit_confidence,
    monkeypatch_status: finding.monkeypatch?.status || 'not-attempted',
    fix_status: 'unfixed',
    location: {
      file: finding.location.file,
      line: finding.location.line,
      endpoint: finding.location.endpoint,
      method: finding.location.method,
      parameter: finding.location.parameter,
    },
    description: finding.description,
    reproduction: finding.reproduction,
    server_logs: finding.server_logs,
    monkeypatch: finding.monkeypatch ? {
      status: finding.monkeypatch.status,
      diff: finding.monkeypatch.diff,
      validation: finding.monkeypatch.validation,
      post_patch_logs: finding.monkeypatch.post_patch_logs,
    } : undefined,
    recommended_fix: finding.recommended_fix,
    rules_violated: finding.rules_violated,
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
