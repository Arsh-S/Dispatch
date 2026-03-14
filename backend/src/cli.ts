import { runOrchestrator } from './orchestrator/agent';
import { bootstrapLabels } from './github/labels';
import { createIssuesFromReport } from './github/issues';
import { generatePdfReport } from './reporting/pdf';
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

    const useBlaxel = args.includes('--blaxel');
    const remainingArgs = args.filter(a => a !== '--blaxel').slice(2);
    const githubRepo = remainingArgs[0] || process.env.GITHUB_REPO; // optional: owner/repo for issue creation
    const outputPath = path.join(process.cwd(), 'dispatch-output.json');
    const mode = useBlaxel ? 'blaxel' : 'local';

    console.log('=== Dispatch Security Scanner ===');
    console.log(`Target: ${targetDir}`);
    console.log(`Mode: ${mode}`);
    console.log(`Output: ${outputPath}`);
    if (githubRepo) console.log(`GitHub: ${githubRepo}`);
    console.log('');

    // Run orchestrator
    const result = await runOrchestrator({
      targetDir,
      mode,
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

      // Generate PDF report
      const pdfPath = outputPath.replace(/\.json$/, '.pdf');
      try {
        await generatePdfReport(report, pdfPath);
        console.log(`\nPDF report: ${pdfPath}`);

        // Copy PDF to dashboard public dir
        const dashboardPdf = path.join(__dirname, 'dashboard/public/dispatch-report.pdf');
        try { fs.copyFileSync(pdfPath, dashboardPdf); } catch { /* dashboard dir may not exist */ }
      } catch (err: any) {
        console.error(`PDF generation failed: ${err.message}`);
      }

      // Also copy output to dashboard public dir
      const dashboardOutput = path.join(__dirname, 'dashboard/public/dispatch-output.json');
      try {
        fs.copyFileSync(outputPath, dashboardOutput);
        console.log(`Dashboard data updated. Run: cd src/dashboard && pnpm dev`);
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
  } else if (command === 'report') {
    const inputPath = args[1] || path.join(process.cwd(), 'dispatch-output.json');
    const pdfOutputPath = args[2] || inputPath.replace(/\.json$/, '.pdf');

    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      process.exit(1);
    }

    console.log(`Generating PDF report from ${inputPath}...`);
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    const result = await generatePdfReport(data, pdfOutputPath);
    console.log(`PDF report written to: ${result}`);
  } else {
    console.log('Dispatch Security Scanner');
    console.log('');
    console.log('Usage:');
    console.log('  pnpm tsx src/cli.ts scan <path-to-repo> [owner/repo] [--blaxel]');
    console.log('  pnpm tsx src/cli.ts report [input.json] [output.pdf]');
    console.log('');
    console.log('Options:');
    console.log('  --blaxel    Run workers in Blaxel sandboxes (default: local)');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm tsx src/cli.ts scan ./sample-app');
    console.log('  pnpm tsx src/cli.ts scan ./sample-app --blaxel');
    console.log('  pnpm tsx src/cli.ts scan ./sample-app myorg/myrepo');
    console.log('  pnpm tsx src/cli.ts report dispatch-output.json report.pdf');
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
