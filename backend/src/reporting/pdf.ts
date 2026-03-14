import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import type { MergedReport } from '../orchestrator/collector';
import type { Finding } from '../schemas/finding-report';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfReportOptions {
  githubRepo?: string;       // "owner/repo" — enables file permalink URLs
  githubRef?: string;        // commit SHA or branch name (default: "main")
  createdIssues?: Map<string, { number: number; url: string }>; // finding_id → GitHub issue
}

interface FontConfig {
  regular: string;
  bold: string;
  semiBold: string;
  mono: string;
}

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

/** Exported for unit testing. */
export function githubFileUrl(
  repo: string,
  ref: string,
  file: string,
  line?: number,
): string {
  const base = `https://github.com/${repo}/blob/${ref}/${file}`;
  if (!line || line <= 0) return base;
  return `${base}#L${line}`;
}

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export async function generatePdfReport(
  scanResult: MergedReport,
  outputPath: string,
  options?: PdfReportOptions,
): Promise<string> {
  const opts = options ?? {};
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

    // Register custom fonts with fallback to built-in
    const fontsDir = path.resolve(__dirname, '../../assets/fonts');
    const interReg = path.join(fontsDir, 'Inter-Regular.ttf');
    const interBold = path.join(fontsDir, 'Inter-Bold.ttf');
    const interSemi = path.join(fontsDir, 'Inter-SemiBold.ttf');
    const jetbrains = path.join(fontsDir, 'JetBrainsMono-Regular.ttf');

    if (fs.existsSync(interReg)) doc.registerFont('Inter', interReg);
    if (fs.existsSync(interBold)) doc.registerFont('Inter-Bold', interBold);
    if (fs.existsSync(interSemi)) doc.registerFont('Inter-SemiBold', interSemi);
    if (fs.existsSync(jetbrains)) doc.registerFont('JetBrains', jetbrains);

    const fontFamily = fs.existsSync(interReg) ? 'Inter' : 'Helvetica';
    const fontBold = fs.existsSync(interBold) ? 'Inter-Bold' : 'Helvetica-Bold';
    const fontSemi = fs.existsSync(interSemi) ? 'Inter-SemiBold' : 'Helvetica-Bold';
    const fontMono = fs.existsSync(jetbrains) ? 'JetBrains' : 'Courier';

    const fonts: FontConfig = {
      regular: fontFamily,
      bold: fontBold,
      semiBold: fontSemi,
      mono: fontMono,
    };

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Page 1: Executive Summary
    drawExecutiveSummary(doc, scanResult, opts, fonts);

    // Critical & High findings — full detail
    const criticalHighFindings = scanResult.findings.filter(
      f => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    );

    if (criticalHighFindings.length > 0) {
      if (doc.y > 500) doc.addPage();
      else doc.moveDown(2);
      drawSectionHeader(doc, 'Critical & High Severity Findings', fonts);
      doc.moveDown(0.5);

      for (let i = 0; i < criticalHighFindings.length; i++) {
        const estimatedHeight = 150;
        if (doc.y + estimatedHeight > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
        }
        drawFindingFull(doc, criticalHighFindings[i], i + 1, opts, fonts);
      }
    }

    // Medium & Low findings — condensed table
    const mediumLowFindings = scanResult.findings.filter(
      f => f.severity === 'MEDIUM' || f.severity === 'LOW'
    );

    if (mediumLowFindings.length > 0) {
      if (doc.y > 500) doc.addPage();
      else doc.moveDown(2);
      drawSectionHeader(doc, 'Medium & Low Severity Findings', fonts);
      doc.moveDown(0.5);

      for (let i = 0; i < mediumLowFindings.length; i++) {
        const estimatedHeight = 60;
        if (doc.y + estimatedHeight > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
        }
        drawFindingCondensed(doc, mediumLowFindings[i], i + 1, opts, fonts);
      }
    }

    // Clean Endpoints appendix
    if (scanResult.clean_endpoints.length > 0) {
      if (doc.y > 600) doc.addPage();
      else doc.moveDown(2);
      drawSectionHeader(doc, 'Clean Endpoints', fonts);
      doc.moveDown(0.5);
      drawCleanEndpoints(doc, scanResult, fonts);
    }

    // Footer on each page — use flushPages to finalize
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);
      drawPageFooter(doc, i + 1, totalPages, scanResult.dispatch_run_id, fonts);
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

function drawExecutiveSummary(doc: PDFKit.PDFDocument, report: MergedReport, options: Partial<PdfReportOptions> = {}, fonts: FontConfig) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x = doc.page.margins.left;

  // Title block (Phase 3: 70px height, Inter-Bold 28pt, accent line)
  const titleY = doc.y;
  const bannerHeight = 70;
  doc.rect(x, titleY, pageWidth, bannerHeight)
    .fill(COLORS.header);

  doc.font(fonts.bold).fontSize(28).fillColor(COLORS.white);
  doc.text('DISPATCH', x + 16, titleY + 12);
  doc.font(fonts.regular).fontSize(11).fillColor('#C4B5FD');
  doc.text('Security Scan Report', x + 16, titleY + 44);
  doc.rect(x, titleY + bannerHeight, pageWidth, 2).fill('#7C3AED');

  doc.y = titleY + bannerHeight + 14;

  // Run metadata — human-readable timestamp
  const d = new Date(report.completed_at);
  const formatted = d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.muted);
  doc.x = x;
  doc.text(`Run ID: ${report.dispatch_run_id}`, x);
  doc.text(`Completed: ${formatted}`);
  doc.text(`Duration: ${report.duration_seconds}s | Workers: ${report.total_workers}`);
  doc.moveDown(1);

  // Risk score
  const riskScore = computeRiskScore(report);
  const riskLabel = riskScore >= 8 ? 'CRITICAL' : riskScore >= 5 ? 'HIGH' : riskScore >= 2 ? 'MEDIUM' : 'LOW';
  const riskColor = riskScore >= 8 ? COLORS.CRITICAL : riskScore >= 5 ? COLORS.HIGH : riskScore >= 2 ? COLORS.MEDIUM : COLORS.LOW;

  doc.font(fonts.bold).fontSize(12).fillColor(COLORS.text);
  doc.text('Overall Risk Score');
  doc.font(fonts.bold).fontSize(36).fillColor(riskColor);
  doc.text(`${riskScore.toFixed(1)} / 10`, { continued: true });
  doc.font(fonts.regular).fontSize(14).fillColor(riskColor);
  doc.text(`  ${riskLabel}`);
  doc.moveDown(1);

  // Severity breakdown table
  doc.font(fonts.bold).fontSize(12).fillColor(COLORS.text);
  doc.text('Severity Breakdown');
  doc.moveDown(0.3);

  const severities = [
    { label: 'Critical', count: report.summary.critical, color: COLORS.CRITICAL },
    { label: 'High', count: report.summary.high, color: COLORS.HIGH },
    { label: 'Medium', count: report.summary.medium, color: COLORS.MEDIUM },
    { label: 'Low', count: report.summary.low, color: COLORS.LOW },
  ];

  const barStartX = x;
  const barWidth = pageWidth * 0.6;
  const maxCount = Math.max(1, ...severities.map(s => s.count));

  for (const sev of severities) {
    const y = doc.y;
    doc.font(fonts.regular).fontSize(9).fillColor(COLORS.text);
    doc.text(sev.label, barStartX, y, { width: 60 });

    const filledWidth = (sev.count / maxCount) * barWidth * 0.7;
    doc.rect(barStartX + 65, y + 1, Math.max(filledWidth, 2), 10)
      .fill(sev.color);

    doc.font(fonts.bold).fontSize(9).fillColor(COLORS.text);
    doc.text(`${sev.count}`, barStartX + 70 + filledWidth, y, { width: 40 });
    doc.y = y + 18;
  }

  doc.x = x;
  doc.moveDown(1);

  // Endpoints summary
  doc.font(fonts.bold).fontSize(12).fillColor(COLORS.text);
  doc.text('Endpoint Coverage');
  doc.moveDown(0.3);
  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.text);
  doc.text(`Total Endpoints Tested: ${report.summary.total_endpoints}`);
  doc.text(`Vulnerable: ${report.summary.vulnerable_endpoints}`);
  doc.text(`Clean: ${report.summary.clean_endpoints}`);

  // Finding summary table (Task 2.3)
  if (report.findings.length > 0) {
    doc.moveDown(1);
    doc.font(fonts.bold).fontSize(12).fillColor(COLORS.text);
    doc.text('Finding Summary');
    doc.moveDown(0.3);

    const ref = options?.githubRef || 'main';
    const displayFindings = report.findings.slice(0, 15);
    const hasMore = report.findings.length > 15;

    for (let i = 0; i < displayFindings.length; i++) {
      const f = displayFindings[i];
      const locDisplay = f.location.line > 0
        ? `${f.location.file}:${f.location.line}`
        : f.location.file;
      const locTruncated = locDisplay.length > 45
        ? '…/' + locDisplay.split('/').slice(-3).join('/')
        : locDisplay;
      const issue = options?.createdIssues?.get(f.finding_id);

      doc.font(fonts.regular).fontSize(8).fillColor(COLORS.text);
      doc.text(`${i + 1}`, x, doc.y, { width: 20 });
      doc.text(SEVERITY_LABELS[f.severity] || f.severity, x + 22, doc.y, { width: 50 });
      doc.text(f.vuln_type.toUpperCase(), x + 74, doc.y, { width: 80 });

      if (options?.githubRepo) {
        const fileUrl = githubFileUrl(options.githubRepo, ref, f.location.file, f.location.line);
        doc.font(fonts.mono).fontSize(8).fillColor('#2563EB');
        doc.text(locTruncated, x + 156, doc.y, { link: fileUrl, underline: true, width: 120 });
      } else {
        doc.font(fonts.mono).fontSize(8).fillColor(COLORS.text);
        doc.text(locTruncated, x + 156, doc.y, { width: 120 });
      }

      if (issue) {
        doc.font(fonts.regular).fontSize(8).fillColor('#2563EB');
        doc.text(`#${issue.number}`, x + 278, doc.y, { link: issue.url, underline: true, width: 40 });
      } else {
        doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted);
        doc.text('—', x + 278, doc.y, { width: 40 });
      }
      doc.y += 12;
    }

    if (hasMore) {
      doc.font(fonts.regular).fontSize(7).fillColor(COLORS.muted);
      doc.text(`(${report.findings.length - 15} more — see details below)`, x);
      doc.moveDown(0.3);
    }
    doc.moveDown(0.5);
  }

  if (report.worker_errors.length > 0) {
    doc.moveDown(0.5);
    doc.font(fonts.bold).fontSize(10).fillColor(COLORS.CRITICAL);
    doc.text(`Worker Errors: ${report.worker_errors.length}`);
    doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted);
    for (const err of report.worker_errors.slice(0, 5)) {
      doc.text(`  ${err.worker_id}: ${err.error}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Finding — Full Detail (for Critical/High)
// ---------------------------------------------------------------------------

function drawFindingFull(doc: PDFKit.PDFDocument, finding: Finding, index: number, options?: PdfReportOptions, fonts?: FontConfig) {
  const f = fonts ?? { regular: 'Helvetica', bold: 'Helvetica-Bold', semiBold: 'Helvetica-Bold', mono: 'Courier' };
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x = doc.page.margins.left;
  const severityColor = COLORS[finding.severity as keyof typeof COLORS] || COLORS.MEDIUM;

  // Header row: severity stripe (6px) + title + issue badge + severity badge
  const headerY = doc.y;
  doc.rect(x, headerY, 6, 22).fill(severityColor);
  doc.font(f.semiBold).fontSize(11).fillColor(COLORS.text);
  doc.text(`#${index}  ${finding.vuln_type.toUpperCase()}`, x + 14, headerY + 3, { width: pageWidth - 200 });

  const issue = options?.createdIssues?.get(finding.finding_id);
  if (issue) {
    doc.font(f.regular).fontSize(7).fillColor('#2563EB');
    doc.text(`Issue #${issue.number}`, x + pageWidth - 140, headerY + 5, { link: issue.url, underline: true });
  }

  drawBadge(doc, SEVERITY_LABELS[finding.severity] || finding.severity, severityColor, x + pageWidth - 70, headerY + 3, f);

  doc.y = headerY + 26;

  // Location block
  doc.font(f.bold).fontSize(9).fillColor(COLORS.text);
  doc.text(`${finding.location.method} ${finding.location.endpoint}`, x + 10);

  const fileRef = finding.location.line > 0
    ? `${finding.location.file}:${finding.location.line}`
    : finding.location.file;

  if (options?.githubRepo) {
    const url = githubFileUrl(
      options.githubRepo,
      options.githubRef || 'main',
      finding.location.file,
      finding.location.line,
    );
    doc.font(f.mono).fontSize(8).fillColor('#2563EB');
    doc.text(fileRef, x + 10, doc.y, { link: url, underline: true });
  } else {
    doc.font(f.mono).fontSize(8).fillColor(COLORS.text);
    doc.text(fileRef, x + 10);
  }
  doc.moveDown(0.2);

  if (finding.location.parameter) {
    doc.font(f.regular).fontSize(8).fillColor(COLORS.muted);
    doc.text(`Parameter: ${finding.location.parameter}`, x + 10);
    doc.moveDown(0.2);
  }

  // Metadata row (middle-dot separators)
  const metaParts: string[] = [];
  if (finding.cvss_score) metaParts.push(`CVSS ${finding.cvss_score}`);
  if (finding.owasp) metaParts.push(finding.owasp);
  metaParts.push(finding.exploit_confidence);
  metaParts.push(`Monkeypatch: ${finding.monkeypatch.status}`);
  if (finding.monkeypatch.status === 'validated') metaParts.push('Patched ✓');
  doc.font(f.regular).fontSize(8).fillColor(COLORS.muted);
  doc.text(metaParts.join(' · '), x + 10);
  doc.moveDown(0.3);

  // Description
  doc.font(f.regular).fontSize(9).fillColor(COLORS.text);
  doc.text(finding.description, x + 10, doc.y, { width: pageWidth - 20 });
  doc.moveDown(0.3);

  // Reproduction — code block with background
  if (finding.reproduction) {
    doc.font(f.semiBold).fontSize(9).fillColor(COLORS.subheader);
    doc.text('Reproduction', x + 10);
    doc.moveDown(0.2);

    const cmd = finding.reproduction.command.length > 300
      ? finding.reproduction.command.slice(0, 297) + '...'
      : finding.reproduction.command;

    const codeBlockHeight = doc.heightOfString(cmd, { width: pageWidth - 28 }) + 8;
    doc.rect(x + 10, doc.y - 2, pageWidth - 20, codeBlockHeight + 4)
      .fill('#F3F4F6');
    doc.font(f.mono).fontSize(7).fillColor(COLORS.text);
    doc.text(cmd, x + 14, doc.y + 2, { width: pageWidth - 28 });
    doc.y += codeBlockHeight + 6;

    doc.font(f.regular).fontSize(7).fillColor(COLORS.muted);
    doc.text(`Expected: ${finding.reproduction.expected}`, x + 14);
    doc.text(`Actual: ${finding.reproduction.actual}`, x + 14);
    doc.moveDown(0.2);
  }

  // Monkeypatch diff — line-level background colors
  if (finding.monkeypatch.diff) {
    doc.font(f.semiBold).fontSize(9).fillColor(COLORS.subheader);
    doc.text('Monkeypatch', x + 10);
    doc.moveDown(0.2);

    const diffLines = finding.monkeypatch.diff.split('\n').slice(0, 10);
    const lineHeight = 10;
    for (const line of diffLines) {
      let bgColor = '#F3F4F6';
      let textColor = COLORS.muted;
      if (line.startsWith('+')) { bgColor = '#DCFCE7'; textColor = '#16A34A'; }
      else if (line.startsWith('-')) { bgColor = '#FEE2E2'; textColor = '#DC2626'; }

      doc.rect(x + 10, doc.y, pageWidth - 20, lineHeight).fill(bgColor);
      doc.font(f.mono).fontSize(7.5).fillColor(textColor);
      doc.text(line, x + 14, doc.y + 1, { width: pageWidth - 28 });
      doc.y += lineHeight;
    }
    doc.fillColor(COLORS.text);
    doc.moveDown(0.2);
  }

  // Recommended fix
  doc.font(f.semiBold).fontSize(9).fillColor(COLORS.subheader);
  doc.text('Recommended Fix', x + 10);
  doc.font(f.regular).fontSize(8).fillColor(COLORS.text);
  doc.text(finding.recommended_fix, x + 14, doc.y, { width: pageWidth - 28 });
  doc.moveDown(0.3);

  // Rules violated
  if (finding.rules_violated.length > 0) {
    doc.font(f.bold).fontSize(7).fillColor(COLORS.CRITICAL);
    doc.text(`Rules violated: ${finding.rules_violated.join(', ')}`, x + 10, doc.y, { width: pageWidth - 20 });
  }

  doc.moveDown(0.8);

  // Separator
  doc.rect(x, doc.y, pageWidth, 0.5).fill(COLORS.border);
  doc.y += 12;
}

// ---------------------------------------------------------------------------
// Finding — Condensed (for Medium/Low)
// ---------------------------------------------------------------------------

function drawFindingCondensed(doc: PDFKit.PDFDocument, finding: Finding, index: number, options?: PdfReportOptions, fonts?: FontConfig) {
  const f = fonts ?? { regular: 'Helvetica', bold: 'Helvetica-Bold', semiBold: 'Helvetica-Bold', mono: 'Courier' };
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x = doc.page.margins.left;
  const severityColor = COLORS[finding.severity as keyof typeof COLORS] || COLORS.MEDIUM;

  const y = doc.y;
  doc.rect(x, y, 4, 16).fill(severityColor);

  doc.font(f.bold).fontSize(8).fillColor(COLORS.text);
  doc.text(`#${index}  ${finding.vuln_type.toUpperCase()}`, x + 10, y + 2, { width: pageWidth * 0.35 });

  const issue = options?.createdIssues?.get(finding.finding_id);
  if (issue) {
    doc.font(f.regular).fontSize(7).fillColor('#2563EB');
    doc.text(`Issue #${issue.number}`, x + pageWidth - 100, y + 2, { link: issue.url, underline: true });
  }

  doc.y = y + 16;

  doc.font(f.bold).fontSize(8).fillColor(COLORS.text);
  doc.text(`${finding.location.method} ${finding.location.endpoint}`, x + 10);

  const fileRef = finding.location.line > 0
    ? `${finding.location.file}:${finding.location.line}`
    : finding.location.file;

  if (options?.githubRepo) {
    const url = githubFileUrl(
      options.githubRepo,
      options.githubRef || 'main',
      finding.location.file,
      finding.location.line,
    );
    doc.font(f.mono).fontSize(8).fillColor('#2563EB');
    doc.text(fileRef, x + 10, doc.y, { link: url, underline: true });
  } else {
    doc.font(f.mono).fontSize(8).fillColor(COLORS.muted);
    doc.text(fileRef, x + 10);
  }
  doc.moveDown(0.2);

  // One-line metadata
  const parts: string[] = [];
  if (finding.cvss_score) parts.push(`CVSS ${finding.cvss_score}`);
  if (finding.owasp) parts.push(finding.owasp);
  parts.push(finding.exploit_confidence);
  parts.push(`patch: ${finding.monkeypatch.status}`);

  doc.font(f.regular).fontSize(7).fillColor(COLORS.muted);
  doc.text(parts.join(' · '), x + 10);

  // Truncated description
  const desc = finding.description.length > 200
    ? finding.description.slice(0, 197) + '...'
    : finding.description;
  doc.font(f.regular).fontSize(7).fillColor(COLORS.text);
  doc.text(desc, x + 10, doc.y, { width: pageWidth - 20 });

  doc.moveDown(0.5);
}

// ---------------------------------------------------------------------------
// Clean Endpoints — grouped by route
// ---------------------------------------------------------------------------

function drawCleanEndpoints(doc: PDFKit.PDFDocument, report: MergedReport, fonts: FontConfig) {
  const x = doc.page.margins.left;

  const groups = new Map<string, Array<{ parameter: string; attack_type: string; notes: string }>>();
  for (const ep of report.clean_endpoints) {
    const key = ep.endpoint;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      parameter: ep.parameter || '',
      attack_type: ep.attack_type,
      notes: ep.notes,
    });
  }

  doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted);
  doc.text(`${groups.size} unique endpoints passed all attack vectors:`, x);
  doc.moveDown(0.4);

  for (const [endpoint, params] of groups) {
    if (doc.y > 700) doc.addPage();
    doc.font(fonts.bold).fontSize(8).fillColor(COLORS.LOW);
    doc.text(endpoint, x + 8);

    for (const p of params) {
      doc.font(fonts.regular).fontSize(7).fillColor(COLORS.muted);
      const paramLabel = p.parameter ? p.parameter : 'all';
      doc.text(`  ✓ ${paramLabel} (${p.attack_type})`, x + 16);
    }
    doc.moveDown(0.3);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, fonts: FontConfig) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.rect(doc.page.margins.left, doc.y, pageWidth, 24).fill(COLORS.header);
  doc.font(fonts.bold).fontSize(14).fillColor(COLORS.white);
  doc.text(title, doc.page.margins.left + 12, doc.y - 18);
  doc.y += 10;
}

function drawBadge(doc: PDFKit.PDFDocument, label: string, color: string, x: number, y: number, fonts?: FontConfig) {
  const width = 55;
  const f = fonts ?? { regular: 'Helvetica', bold: 'Helvetica-Bold', semiBold: 'Helvetica-Bold', mono: 'Courier' };
  doc.roundedRect(x, y, width, 14, 3).fill(color);
  doc.font(f.bold).fontSize(7).fillColor(COLORS.white);
  doc.text(label, x, y + 3, { width, align: 'center' });
}

function drawPageFooter(doc: PDFKit.PDFDocument, page: number, total: number, runId: string, fonts: FontConfig) {
  const y = doc.page.height - 30;
  const x = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Use save/restore to prevent cursor movement from affecting pagination
  doc.save();

  // Draw left-aligned run ID
  doc.font(fonts.regular).fontSize(7).fillColor(COLORS.muted);
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
