import PDFDocument from 'pdfkit';
import fs from 'fs';
import type { MergedReport } from '../orchestrator/collector';
import type { Finding } from '../schemas/finding-report';

// Colors
const COLORS = {
  CRITICAL: '#DC2626',
  HIGH: '#EA580C',
  MEDIUM: '#CA8A04',
  LOW: '#65A30D',
  header: '#1E1B4B',
  subheader: '#4338CA',
  text: '#1F2937',
  muted: '#6B7280',
  bg: '#F8FAFC',
  accent: '#7C3AED',
  border: '#E5E7EB',
  white: '#FFFFFF',
} as const;

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export async function generatePdfReport(
  scanResult: MergedReport,
  outputPath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Dispatch Security Report — ${scanResult.dispatch_run_id}`,
        Author: 'Dispatch Security Scanner',
        Subject: 'Security Scan Results',
        CreationDate: new Date(),
      },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Page 1: Executive Summary
    drawExecutiveSummary(doc, scanResult);

    // Critical & High findings — full detail
    const criticalHighFindings = scanResult.findings.filter(
      f => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    );

    if (criticalHighFindings.length > 0) {
      doc.addPage();
      drawSectionHeader(doc, 'Critical & High Severity Findings');
      doc.moveDown(0.5);

      for (let i = 0; i < criticalHighFindings.length; i++) {
        if (doc.y > 650) doc.addPage();
        drawFindingFull(doc, criticalHighFindings[i], i + 1);
      }
    }

    // Medium & Low findings — condensed table
    const mediumLowFindings = scanResult.findings.filter(
      f => f.severity === 'MEDIUM' || f.severity === 'LOW'
    );

    if (mediumLowFindings.length > 0) {
      doc.addPage();
      drawSectionHeader(doc, 'Medium & Low Severity Findings');
      doc.moveDown(0.5);

      for (let i = 0; i < mediumLowFindings.length; i++) {
        if (doc.y > 650) doc.addPage();
        drawFindingCondensed(doc, mediumLowFindings[i], i + 1);
      }
    }

    // Clean Endpoints appendix
    if (scanResult.clean_endpoints.length > 0) {
      doc.addPage();
      drawSectionHeader(doc, 'Clean Endpoints');
      doc.moveDown(0.5);
      drawCleanEndpoints(doc, scanResult);
    }

    // Footer on each page — use flushPages to finalize
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);
      drawPageFooter(doc, i + 1, totalPages, scanResult.dispatch_run_id);
    }
    doc.flushPages();

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

function drawExecutiveSummary(doc: PDFKit.PDFDocument, report: MergedReport) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Title block
  const titleY = doc.y;
  doc.rect(doc.page.margins.left, titleY, pageWidth, 60)
    .fill(COLORS.header);

  doc.font('Helvetica-Bold').fontSize(24).fillColor(COLORS.white);
  doc.text('DISPATCH', doc.page.margins.left + 16, titleY + 10);
  doc.font('Helvetica').fontSize(10).fillColor('#C4B5FD');
  doc.text('Security Scan Report', doc.page.margins.left + 16, titleY + 38);

  doc.y = titleY + 72;

  // Run metadata
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  doc.text(`Run ID: ${report.dispatch_run_id}`, doc.page.margins.left);
  doc.text(`Completed: ${new Date(report.completed_at).toLocaleString()}`);
  doc.text(`Duration: ${report.duration_seconds}s | Workers: ${report.total_workers}`);
  doc.moveDown(1);

  // Risk score
  const riskScore = computeRiskScore(report);
  const riskLabel = riskScore >= 8 ? 'CRITICAL' : riskScore >= 5 ? 'HIGH' : riskScore >= 2 ? 'MEDIUM' : 'LOW';
  const riskColor = riskScore >= 8 ? COLORS.CRITICAL : riskScore >= 5 ? COLORS.HIGH : riskScore >= 2 ? COLORS.MEDIUM : COLORS.LOW;

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
  doc.text('Overall Risk Score');
  doc.font('Helvetica-Bold').fontSize(36).fillColor(riskColor);
  doc.text(`${riskScore.toFixed(1)} / 10`, { continued: true });
  doc.font('Helvetica').fontSize(14).fillColor(riskColor);
  doc.text(`  ${riskLabel}`);
  doc.moveDown(1);

  // Severity breakdown table
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
  doc.text('Severity Breakdown');
  doc.moveDown(0.3);

  const severities = [
    { label: 'Critical', count: report.summary.critical, color: COLORS.CRITICAL },
    { label: 'High', count: report.summary.high, color: COLORS.HIGH },
    { label: 'Medium', count: report.summary.medium, color: COLORS.MEDIUM },
    { label: 'Low', count: report.summary.low, color: COLORS.LOW },
  ];

  const barStartX = doc.page.margins.left;
  const barWidth = pageWidth * 0.6;
  const maxCount = Math.max(1, ...severities.map(s => s.count));

  for (const sev of severities) {
    const y = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text(sev.label, barStartX, y, { width: 60 });

    const filledWidth = (sev.count / maxCount) * barWidth * 0.7;
    doc.rect(barStartX + 65, y + 1, Math.max(filledWidth, 2), 10)
      .fill(sev.color);

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text);
    doc.text(`${sev.count}`, barStartX + 70 + barWidth * 0.7, y, { width: 40 });
    doc.y = y + 18;
  }

  doc.moveDown(1);

  // Endpoints summary
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text);
  doc.text('Endpoint Coverage');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
  doc.text(`Total Endpoints Tested: ${report.summary.total_endpoints}`);
  doc.text(`Vulnerable: ${report.summary.vulnerable_endpoints}`);
  doc.text(`Clean: ${report.summary.clean_endpoints}`);

  if (report.worker_errors.length > 0) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.CRITICAL);
    doc.text(`Worker Errors: ${report.worker_errors.length}`);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    for (const err of report.worker_errors.slice(0, 5)) {
      doc.text(`  ${err.worker_id}: ${err.error}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Finding — Full Detail (for Critical/High)
// ---------------------------------------------------------------------------

function drawFindingFull(doc: PDFKit.PDFDocument, finding: Finding, index: number) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x = doc.page.margins.left;
  const severityColor = COLORS[finding.severity as keyof typeof COLORS] || COLORS.MEDIUM;

  // Finding header with severity stripe
  const headerY = doc.y;
  doc.rect(x, headerY, 4, 20).fill(severityColor);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
  doc.text(`#${index}  ${finding.vuln_type.toUpperCase()}`, x + 10, headerY + 2, { width: pageWidth - 120 });

  // Severity badge
  drawBadge(doc, SEVERITY_LABELS[finding.severity] || finding.severity, severityColor, x + pageWidth - 70, headerY + 2);

  doc.y = headerY + 24;

  // Location
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
  doc.text(`${finding.location.method} ${finding.location.endpoint}  |  ${finding.location.file}:${finding.location.line}`, x + 10);
  if (finding.location.parameter) {
    doc.text(`Parameter: ${finding.location.parameter}`, x + 10);
  }

  // Metadata row
  const metaParts: string[] = [];
  if (finding.cvss_score) metaParts.push(`CVSS: ${finding.cvss_score}`);
  if (finding.owasp) metaParts.push(`OWASP: ${finding.owasp}`);
  metaParts.push(`Exploit: ${finding.exploit_confidence}`);
  metaParts.push(`Monkeypatch: ${finding.monkeypatch.status}`);
  doc.text(metaParts.join('  |  '), x + 10);
  doc.moveDown(0.3);

  // Description
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
  doc.text(finding.description, x + 10, doc.y, { width: pageWidth - 20 });
  doc.moveDown(0.3);

  // Reproduction
  if (finding.reproduction) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.subheader);
    doc.text('Reproduction', x + 10);
    doc.font('Courier').fontSize(7).fillColor(COLORS.text);

    // Truncate very long commands
    const cmd = finding.reproduction.command.length > 300
      ? finding.reproduction.command.slice(0, 297) + '...'
      : finding.reproduction.command;

    doc.rect(x + 10, doc.y, pageWidth - 20, 1).fill(COLORS.border);
    doc.y += 2;
    doc.text(cmd, x + 14, doc.y, { width: pageWidth - 28 });
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
    doc.text(`Expected: ${finding.reproduction.expected}`, x + 14);
    doc.text(`Actual: ${finding.reproduction.actual}`, x + 14);
    doc.moveDown(0.2);
  }

  // Monkeypatch diff (abbreviated)
  if (finding.monkeypatch.diff) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.subheader);
    doc.text('Monkeypatch', x + 10);

    const diffLines = finding.monkeypatch.diff.split('\n').slice(0, 10);
    doc.font('Courier').fontSize(6).fillColor(COLORS.text);
    for (const line of diffLines) {
      if (line.startsWith('+')) doc.fillColor('#16A34A');
      else if (line.startsWith('-')) doc.fillColor(COLORS.CRITICAL);
      else doc.fillColor(COLORS.muted);
      doc.text(line, x + 14, doc.y, { width: pageWidth - 28 });
    }
    doc.fillColor(COLORS.text);
    doc.moveDown(0.2);
  }

  // Recommended fix
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.subheader);
  doc.text('Recommended Fix', x + 10);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
  doc.text(finding.recommended_fix, x + 14, doc.y, { width: pageWidth - 28 });
  doc.moveDown(0.3);

  // Rules violated
  if (finding.rules_violated.length > 0) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.CRITICAL);
    doc.text(`Rules violated: ${finding.rules_violated.join(', ')}`, x + 10, doc.y, { width: pageWidth - 20 });
  }

  doc.moveDown(0.8);

  // Separator
  doc.rect(x, doc.y, pageWidth, 0.5).fill(COLORS.border);
  doc.y += 8;
}

// ---------------------------------------------------------------------------
// Finding — Condensed (for Medium/Low)
// ---------------------------------------------------------------------------

function drawFindingCondensed(doc: PDFKit.PDFDocument, finding: Finding, index: number) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x = doc.page.margins.left;
  const severityColor = COLORS[finding.severity as keyof typeof COLORS] || COLORS.MEDIUM;

  const y = doc.y;
  doc.rect(x, y, 3, 14).fill(severityColor);

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.text);
  doc.text(`#${index}  ${finding.vuln_type.toUpperCase()}`, x + 8, y + 1, { continued: true, width: pageWidth * 0.35 });

  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
  doc.text(`  ${finding.location.endpoint}  |  ${finding.location.file}:${finding.location.line}`, { continued: false });

  doc.y = y + 16;

  // One-line metadata
  const parts: string[] = [];
  if (finding.cvss_score) parts.push(`CVSS ${finding.cvss_score}`);
  if (finding.owasp) parts.push(finding.owasp);
  parts.push(finding.exploit_confidence);
  parts.push(`patch: ${finding.monkeypatch.status}`);

  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
  doc.text(parts.join('  |  '), x + 8);

  // Truncated description
  const desc = finding.description.length > 200
    ? finding.description.slice(0, 197) + '...'
    : finding.description;
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.text);
  doc.text(desc, x + 8, doc.y, { width: pageWidth - 16 });

  doc.moveDown(0.5);
}

// ---------------------------------------------------------------------------
// Clean Endpoints
// ---------------------------------------------------------------------------

function drawCleanEndpoints(doc: PDFKit.PDFDocument, report: MergedReport) {
  const x = doc.page.margins.left;

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
  doc.text(`${report.clean_endpoints.length} endpoints passed all attack vectors:`, x);
  doc.moveDown(0.3);

  for (const ep of report.clean_endpoints) {
    if (doc.y > 720) doc.addPage();
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.LOW);
    doc.text(`  ${ep.endpoint}`, x);
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
    doc.text(`    ${ep.attack_type} — ${ep.notes}`, x);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.rect(doc.page.margins.left, doc.y, pageWidth, 24).fill(COLORS.header);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.white);
  doc.text(title, doc.page.margins.left + 12, doc.y - 18);
  doc.y += 10;
}

function drawBadge(doc: PDFKit.PDFDocument, label: string, color: string, x: number, y: number) {
  const width = 55;
  doc.roundedRect(x, y, width, 14, 3).fill(color);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white);
  doc.text(label, x, y + 3, { width, align: 'center' });
}

function drawPageFooter(doc: PDFKit.PDFDocument, page: number, total: number, runId: string) {
  const y = doc.page.height - 30;
  const x = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Use save/restore to prevent cursor movement from affecting pagination
  doc.save();

  // Draw left-aligned run ID
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
  doc.text(`Dispatch — ${runId}`, x, y, { lineBreak: false });

  // Draw right-aligned page number using widthOfString for manual positioning
  const pageText = `Page ${page} of ${total}`;
  const textWidth = doc.widthOfString(pageText);
  doc.text(pageText, x + pageWidth - textWidth, y, { lineBreak: false });

  doc.restore();
}

function computeRiskScore(report: MergedReport): number {
  const totalEndpoints = Math.max(1, report.summary.total_endpoints);
  const raw = (report.summary.critical * 10 + report.summary.high * 5 + report.summary.medium * 2 + report.summary.low * 1) / totalEndpoints;
  return Math.min(10, raw);
}
