import { runOrchestrator } from './orchestrator/agent';
import { bootstrapLabels } from './github/labels';
import { createIssuesFromReport, convertFindingToIssueFormat } from './github/issues';
import { createLinearIssuesFromReport } from './linear/issues';
import { generatePdfReport } from './reporting/pdf';
import { Finding, CleanEndpoint } from './schemas/finding-report';
import { runLocalTestRunner } from './test-runner';
import { initDatadog } from './integrations/datadog/client';
import { forwardTestRunToDatadog } from './integrations/datadog/test-run-forwarder';
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
    // Write to frontend/public for live graph view (frontend polls every 2s)
    const frontendPublic = path.join(__dirname, '../../frontend/public');
    const outputPath = fs.existsSync(frontendPublic)
      ? path.join(frontendPublic, 'dispatch-output.json')
      : path.join(process.cwd(), 'dispatch-output.json');
    const mode = useBlaxel ? 'blaxel' : 'local';

    console.log('=== Dispatch Security Scanner ===');
    console.log(`Target: ${targetDir}`);
    console.log(`Mode: ${mode}`);
    console.log(`Output: ${outputPath}${outputPath.includes('frontend/public') ? ' (live graph)' : ''}`);
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

      let issues: { number: number; url: string; title: string }[] | undefined;
      const issueFindings = report.findings.map(f => convertFindingToIssueFormat(f, result.preRecon.dispatch_run_id));

      if (githubRepo && report.findings.length > 0) {
        console.log(`\nCreating GitHub Issues on ${githubRepo}...`);
        try {
          await bootstrapLabels(githubRepo);
          issues = await createIssuesFromReport(githubRepo, issueFindings);
          console.log(`Created ${issues.length} GitHub issues:`);
          issues.forEach(i => console.log(`  #${i.number}: ${i.title} — ${i.url}`));
        } catch (err: any) {
          console.error(`GitHub issue creation failed: ${err.message}`);
        }
      }

      const linearTeamId = process.env.LINEAR_TEAM_ID;
      if (linearTeamId && report.findings.length > 0) {
        console.log(`\nCreating Linear Issues...`);
        try {
          const dispatchFixUrl = process.env.DISPATCH_FIX_URL;
          const linearIssues = await createLinearIssuesFromReport(linearTeamId, issueFindings, dispatchFixUrl, process.env.GITHUB_REPO);
          console.log(`Created ${linearIssues.length} Linear issues:`);
          linearIssues.forEach(i => console.log(`  ${i.identifier}: ${i.title} — ${i.url}`));
        } catch (err: any) {
          console.error(`Linear issue creation failed: ${err.message}`);
        }
      }

      // Build issue map for PDF cross-referencing
      const issueMap = new Map<string, { number: number; url: string }>();
      if (issues) {
        report.findings.forEach((f, i) => {
          if (issues![i]) {
            issueMap.set(f.finding_id, { number: issues![i].number, url: issues![i].url });
          }
        });
      }

      // Generate PDF report
      const pdfPath = outputPath.replace(/\.json$/, '.pdf');
      try {
        await generatePdfReport(report, pdfPath, {
          githubRepo,
          githubRef: result.gitSha ?? 'main',
          createdIssues: issueMap.size > 0 ? issueMap : undefined,
        });
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
        /* dashboard dir may not exist */
      }

      console.log(`\nFull report: ${outputPath}`);
    } else {
      console.log('\nNo findings collected. Workers may have encountered errors.');
      result.workerResults.forEach(w => {
        if (w.error) console.log(`  ${w.workerId}: ${w.error}`);
      });
    }

    // Output is written directly to frontend/public for live graph (no copy needed)
  } else if (command === 'report') {
    const inputPath = args[1] || path.join(process.cwd(), 'dispatch-output.json');
    const pdfOutputPath = args[2] || inputPath.replace(/\.json$/, '.pdf');
    const repoFlag = args.find(a => a.startsWith('--repo='))?.split('=')[1];
    const refFlag = args.find(a => a.startsWith('--ref='))?.split('=')[1];

    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      process.exit(1);
    }

    console.log(`Generating PDF report from ${inputPath}...`);
    const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    const data = normalizeToMergedReport(raw);
    const result = await generatePdfReport(data, pdfOutputPath, {
      githubRepo: repoFlag,
      githubRef: refFlag || 'main',
    });
    console.log(`PDF report written to: ${result}`);
  } else if (command === 'test-suite') {
    const targetPath = args[1];
    if (!targetPath) {
      console.error('Usage: pnpm tsx src/cli.ts test-suite <path-to-repo> [--command "..."] [--timeout 300]');
      process.exit(1);
    }

    const targetDir = path.resolve(targetPath);
    if (!fs.existsSync(targetDir)) {
      console.error(`Target directory not found: ${targetDir}`);
      process.exit(1);
    }

    const commandFlag = args.find(a => a.startsWith('--command='))?.split('=').slice(1).join('=')
      || (args.includes('--command') ? args[args.indexOf('--command') + 1] : undefined);
    const timeoutFlag = args.find(a => a.startsWith('--timeout='))?.split('=')[1]
      || (args.includes('--timeout') ? args[args.indexOf('--timeout') + 1] : undefined);

    const frontendPublic = path.join(__dirname, '../../frontend/public');
    const outputPath = fs.existsSync(frontendPublic)
      ? path.join(frontendPublic, 'test-run-output.json')
      : path.join(process.cwd(), 'test-run-output.json');

    console.log('=== Dispatch Test Suite Runner ===');
    console.log(`Target: ${targetDir}`);
    if (commandFlag) console.log(`Command: ${commandFlag}`);
    console.log(`Output: ${outputPath}`);
    console.log('');

    const report = await runLocalTestRunner(targetDir, {
      command: commandFlag,
      timeoutSeconds: timeoutFlag ? parseInt(timeoutFlag, 10) : undefined,
    });

    const output = {
      run_id: report.dispatch_run_id,
      status: report.status,
      report,
      started_at: new Date(Date.now() - report.duration_seconds * 1000).toISOString(),
      completed_at: report.completed_at,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log(`Status: ${report.status}`);
    console.log(`Exit code: ${report.exit_code}`);
    console.log(`Duration: ${report.duration_seconds}s`);
    console.log(`Command: ${report.command}`);

    if (report.parsed_summary) {
      const s = report.parsed_summary;
      console.log(`\nTest Summary (${s.framework ?? 'unknown'}):`);
      if (s.passed !== undefined) console.log(`  Passed: ${s.passed}`);
      if (s.failed !== undefined) console.log(`  Failed: ${s.failed}`);
      if (s.skipped !== undefined) console.log(`  Skipped: ${s.skipped}`);
      if (s.total !== undefined) console.log(`  Total: ${s.total}`);
    }

    console.log(`\nFull report: ${outputPath}`);

    if (report.status === 'failed' || report.status === 'error') {
      process.exit(1);
    }
  } else {
    console.log('Dispatch Security Scanner');
    console.log('');
    console.log('Usage:');
    console.log('  pnpm tsx src/cli.ts scan <path-to-repo> [owner/repo] [--blaxel]');
    console.log('  pnpm tsx src/cli.ts test-suite <path-to-repo> [--command "..."] [--timeout 300]');
    console.log('  pnpm tsx src/cli.ts report [input.json] [output.pdf]');
    console.log('');
    console.log('Options:');
    console.log('  --blaxel    Run workers in Blaxel sandboxes (default: local)');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm tsx src/cli.ts scan ./sample-app');
    console.log('  pnpm tsx src/cli.ts scan ./sample-app --blaxel');
    console.log('  pnpm tsx src/cli.ts scan ./sample-app myorg/myrepo');
    console.log('  pnpm tsx src/cli.ts test-suite ./sample-app');
    console.log('  pnpm tsx src/cli.ts test-suite ./sample-app --command "uv run pytest -v"');
    console.log('  pnpm tsx src/cli.ts report dispatch-output.json report.pdf [--repo=owner/repo] [--ref=main]');
  }
}

function normalizeToMergedReport(raw: unknown): import('./orchestrator/collector').MergedReport {
  const MergedReport = raw as { summary?: { total_endpoints?: number } };
  if (MergedReport?.summary?.total_endpoints !== undefined) {
    return raw as import('./orchestrator/collector').MergedReport;
  }
  const dispatch = raw as {
    dispatch_run_id?: string;
    completed_at?: string;
    finding_reports?: Array<{ findings?: unknown[]; clean_endpoints?: unknown[] }>;
    findings?: unknown[];
  };
  const findings = dispatch.findings ?? dispatch.finding_reports?.flatMap((r: { findings?: unknown[] }) => r.findings ?? []) ?? [];
  const cleanEndpoints = dispatch.finding_reports?.flatMap((r: { clean_endpoints?: unknown[] }) => r.clean_endpoints ?? []) ?? [];
  const vulnerableEndpoints = new Set((findings as Array<{ location?: { endpoint?: string } }>).map(f => f.location?.endpoint).filter(Boolean));
  return {
    dispatch_run_id: dispatch.dispatch_run_id ?? 'unknown',
    completed_at: dispatch.completed_at ?? new Date().toISOString(),
    duration_seconds: 0,
    total_workers: dispatch.finding_reports?.length ?? 0,
    findings: findings as Finding[],
    clean_endpoints: cleanEndpoints as CleanEndpoint[],
    worker_errors: [],
    summary: {
      critical: (findings as Array<{ severity?: string }>).filter(f => f.severity === 'CRITICAL').length,
      high: (findings as Array<{ severity?: string }>).filter(f => f.severity === 'HIGH').length,
      medium: (findings as Array<{ severity?: string }>).filter(f => f.severity === 'MEDIUM').length,
      low: (findings as Array<{ severity?: string }>).filter(f => f.severity === 'LOW').length,
      total_endpoints: Math.max(1, vulnerableEndpoints.size + new Set((cleanEndpoints as Array<{ endpoint?: string }>).map(c => c.endpoint)).size),
      vulnerable_endpoints: vulnerableEndpoints.size,
      clean_endpoints: new Set((cleanEndpoints as Array<{ endpoint?: string }>).map(c => c.endpoint)).size,
    },
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
