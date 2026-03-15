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

// Colors - refined palette
const COLORS = {
  CRITICAL: '#DC2626',
  HIGH: '#EA580C',
  MEDIUM: '#D97706',
  LOW: '#059669',
  header: '#0F172A',
  subheader: '#3730A3',
  text: '#1E293B',
  muted: '#64748B',
  light: '#94A3B8',
  bg: '#F8FAFC',
  codeBg: '#F1F5F9',
  accent: '#6366F1',
  border: '#E2E8F0',
  white: '#FFFFFF',
  success: '#10B981',
  link: '#2563EB',
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

// Page layout constants
const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const FOOTER_HEIGHT = 40;

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
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
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
      doc.addPage();
      drawSectionHeader(doc, 'Critical & High Severity Findings', fonts);

      for (let i = 0; i < criticalHighFindings.length; i++) {
        // Check if we need a new page (leave room for at least 250pt of content)
        if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 250) {
          doc.addPage();
        }
        drawFindingFull(doc, criticalHighFindings[i], i + 1, opts, fonts);
      }
    }

    // Medium & Low findings — condensed
    const mediumLowFindings = scanResult.findings.filter(
      f => f.severity === 'MEDIUM' || f.severity === 'LOW'
    );

    if (mediumLowFindings.length > 0) {
      // Check if we need a new page
      if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 200) {
        doc.addPage();
      } else {
        doc.moveDown(2);
      }
      drawSectionHeader(doc, 'Medium & Low Severity Findings', fonts);

      for (let i = 0; i < mediumLowFindings.length; i++) {
        // Check if we need a new page
        if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 120) {
          doc.addPage();
        }
        drawFindingCondensed(doc, mediumLowFindings[i], i + 1, opts, fonts);
      }
    }

    // Clean Endpoints appendix
    if (scanResult.clean_endpoints.length > 0) {
      if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 150) {
        doc.addPage();
      } else {
        doc.moveDown(2);
      }
      drawSectionHeader(doc, 'Clean Endpoints', fonts);
      drawCleanEndpoints(doc, scanResult, fonts);
    }

    // Footer on each page
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
  const x = MARGIN;

  // Title banner
  const bannerHeight = 80;
  doc.rect(x, doc.y, CONTENT_WIDTH, bannerHeight).fill(COLORS.header);

  doc.font(fonts.bold).fontSize(32).fillColor(COLORS.white);
  doc.text('DISPATCH', x + 24, doc.y + 18, { lineBreak: false });

  doc.font(fonts.regular).fontSize(12).fillColor('#A5B4FC');
  doc.text('Security Scan Report', x + 24, doc.y + 54, { lineBreak: false });

  // Accent line
  doc.rect(x, doc.y + bannerHeight, CONTENT_WIDTH, 3).fill(COLORS.accent);
  doc.y = doc.y + bannerHeight + 24;

  // Run metadata
  const d = new Date(report.completed_at);
  const formatted = d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.muted);
  doc.text(`Run ID: ${report.dispatch_run_id}`, x);
  doc.moveDown(0.3);
  doc.text(`Completed: ${formatted}`);
  doc.moveDown(0.3);
  doc.text(`Duration: ${report.duration_seconds}s  •  Workers: ${report.total_workers}`);
  doc.moveDown(1.5);

  // Two-column layout for stats
  const colWidth = (CONTENT_WIDTH - 20) / 2;
  const statsY = doc.y;

  // Left column: Risk Score
  const riskScore = computeRiskScore(report);
  const riskLabel = riskScore >= 8 ? 'CRITICAL' : riskScore >= 5 ? 'HIGH' : riskScore >= 2 ? 'MEDIUM' : 'LOW';
  const riskColor = riskScore >= 8 ? COLORS.CRITICAL : riskScore >= 5 ? COLORS.HIGH : riskScore >= 2 ? COLORS.MEDIUM : COLORS.LOW;

  // Risk score box
  doc.rect(x, statsY, colWidth, 90).fill('#F8FAFC').stroke(COLORS.border);
  doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.muted);
  doc.text('OVERALL RISK SCORE', x + 16, statsY + 12);

  doc.font(fonts.bold).fontSize(42).fillColor(riskColor);
  doc.text(`${riskScore.toFixed(1)}`, x + 16, statsY + 30);

  doc.font(fonts.semiBold).fontSize(14).fillColor(riskColor);
  doc.text(riskLabel, x + 100, statsY + 48);

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.muted);
  doc.text('out of 10', x + 16, statsY + 72);

  // Right column: Severity breakdown
  const rightX = x + colWidth + 20;
  doc.rect(rightX, statsY, colWidth, 90).fill('#F8FAFC').stroke(COLORS.border);
  doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.muted);
  doc.text('SEVERITY BREAKDOWN', rightX + 16, statsY + 12);

  const severities = [
    { label: 'Critical', count: report.summary.critical, color: COLORS.CRITICAL },
    { label: 'High', count: report.summary.high, color: COLORS.HIGH },
    { label: 'Medium', count: report.summary.medium, color: COLORS.MEDIUM },
    { label: 'Low', count: report.summary.low, color: COLORS.LOW },
  ];

  let sevY = statsY + 32;
  const barMaxWidth = colWidth - 100;
  const maxCount = Math.max(1, ...severities.map(s => s.count));

  for (const sev of severities) {
    doc.font(fonts.regular).fontSize(8).fillColor(COLORS.text);
    doc.text(sev.label, rightX + 16, sevY, { width: 45, lineBreak: false });

    const barWidth = Math.max(4, (sev.count / maxCount) * barMaxWidth * 0.8);
    doc.rect(rightX + 65, sevY + 1, barWidth, 8).fill(sev.color);

    doc.font(fonts.bold).fontSize(8).fillColor(COLORS.text);
    doc.text(`${sev.count}`, rightX + 70 + barWidth, sevY, { lineBreak: false });
    sevY += 14;
  }

  doc.y = statsY + 105;

  // Endpoint coverage
  doc.font(fonts.semiBold).fontSize(11).fillColor(COLORS.text);
  doc.text('Endpoint Coverage', x);
  doc.moveDown(0.5);

  const endpointStats = [
    { label: 'Total Tested', value: report.summary.total_endpoints, color: COLORS.text },
    { label: 'Vulnerable', value: report.summary.vulnerable_endpoints, color: COLORS.CRITICAL },
    { label: 'Clean', value: report.summary.clean_endpoints, color: COLORS.success },
  ];

  const statsRowY = doc.y;
  let epX = x;
  for (const stat of endpointStats) {
    doc.font(fonts.bold).fontSize(20).fillColor(stat.color);
    doc.text(`${stat.value}`, epX, statsRowY, { lineBreak: false, continued: false });
    const numWidth = doc.widthOfString(`${stat.value}`);
    doc.font(fonts.regular).fontSize(9).fillColor(COLORS.muted);
    doc.text(stat.label, epX + numWidth + 6, statsRowY + 6, { lineBreak: false, continued: false });
    epX += 140;
  }
  doc.y = statsRowY + 30;
  doc.moveDown(1);

  // Finding summary table
  if (report.findings.length > 0) {
    doc.font(fonts.semiBold).fontSize(11).fillColor(COLORS.text);
    doc.text('Finding Summary', x);
    doc.moveDown(0.8);

    // Table header
    const tableY = doc.y;
    doc.rect(x, tableY, CONTENT_WIDTH, 20).fill('#F1F5F9');

    doc.font(fonts.semiBold).fontSize(8).fillColor(COLORS.muted);
    doc.text('#', x + 8, tableY + 6, { lineBreak: false });
    doc.text('SEVERITY', x + 30, tableY + 6, { lineBreak: false });
    doc.text('TYPE', x + 95, tableY + 6, { lineBreak: false });
    doc.text('LOCATION', x + 200, tableY + 6, { lineBreak: false });
    doc.text('ISSUE', x + 420, tableY + 6, { lineBreak: false });

    doc.y = tableY + 22;

    const ref = options?.githubRef || 'main';
    const displayFindings = report.findings.slice(0, 10);

    for (let i = 0; i < displayFindings.length; i++) {
      const f = displayFindings[i];
      const rowY = doc.y;

      // Alternating row background
      if (i % 2 === 1) {
        doc.rect(x, rowY, CONTENT_WIDTH, 22).fill('#FAFAFA');
      }

      // Row content - use absolute positioning for each cell
      const cellY = rowY + 6;

      doc.font(fonts.regular).fontSize(8).fillColor(COLORS.text);
      doc.text(`${i + 1}`, x + 8, cellY, { lineBreak: false, continued: false });

      // Severity badge
      const sevColor = COLORS[f.severity as keyof typeof COLORS] || COLORS.MEDIUM;
      doc.font(fonts.bold).fontSize(7).fillColor(sevColor);
      doc.text(f.severity, x + 30, cellY, { lineBreak: false, continued: false });

      // Vuln type
      doc.font(fonts.regular).fontSize(8).fillColor(COLORS.text);
      const vulnType = f.vuln_type.length > 18 ? f.vuln_type.slice(0, 16) + '…' : f.vuln_type;
      doc.text(vulnType.toUpperCase(), x + 95, cellY, { lineBreak: false, continued: false });

      // Location
      const locDisplay = f.location.line > 0
        ? `${f.location.file}:${f.location.line}`
        : f.location.file;
      const locTruncated = locDisplay.length > 35
        ? '…' + locDisplay.slice(-33)
        : locDisplay;

      doc.font(fonts.mono).fontSize(7).fillColor(options?.githubRepo ? COLORS.link : COLORS.text);
      doc.text(locTruncated, x + 200, cellY, { lineBreak: false, continued: false });

      // Issue link
      const issue = options?.createdIssues?.get(f.finding_id);
      if (issue) {
        doc.font(fonts.regular).fontSize(8).fillColor(COLORS.link);
        doc.text(`#${issue.number}`, x + 420, cellY, { lineBreak: false, continued: false });
      } else {
        doc.font(fonts.regular).fontSize(8).fillColor(COLORS.light);
        doc.text('—', x + 420, cellY, { lineBreak: false, continued: false });
      }

      doc.y = rowY + 22;
    }

    if (report.findings.length > 10) {
      doc.moveDown(0.3);
      doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted);
      doc.text(`+ ${report.findings.length - 10} more findings (see details below)`, x);
    }
  }

  // Worker errors (if any)
  if (report.worker_errors.length > 0) {
    doc.moveDown(1.5);
    doc.rect(x, doc.y, CONTENT_WIDTH, 1).fill(COLORS.border);
    doc.moveDown(1);

    doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.CRITICAL);
    doc.text(`⚠ Worker Errors (${report.worker_errors.length})`, x);
    doc.moveDown(0.5);

    for (const err of report.worker_errors.slice(0, 3)) {
      doc.font(fonts.mono).fontSize(8).fillColor(COLORS.muted);
      const errText = err.error.length > 80 ? err.error.slice(0, 77) + '...' : err.error;
      doc.text(`${err.worker_id}: ${errText}`, x + 8, doc.y, { width: CONTENT_WIDTH - 16 });
      doc.moveDown(0.3);
    }
  }
}

// ---------------------------------------------------------------------------
// Finding — Full Detail (for Critical/High)
// ---------------------------------------------------------------------------

function drawFindingFull(doc: PDFKit.PDFDocument, finding: Finding, index: number, options?: PdfReportOptions, fonts?: FontConfig) {
  const f = fonts ?? { regular: 'Helvetica', bold: 'Helvetica-Bold', semiBold: 'Helvetica-Bold', mono: 'Courier' };
  const x = MARGIN;
  const severityColor = COLORS[finding.severity as keyof typeof COLORS] || COLORS.MEDIUM;

  doc.moveDown(0.5);

  // Card container with left border
  const cardStartY = doc.y;
  doc.rect(x, cardStartY, 4, 0).fill(severityColor); // Will extend later

  // Header row
  const headerX = x + 16;
  doc.font(f.bold).fontSize(12).fillColor(COLORS.text);
  doc.text(`${index}. ${finding.vuln_type.toUpperCase()}`, headerX, doc.y);

  // Severity badge (right aligned)
  const badgeX = x + CONTENT_WIDTH - 70;
  doc.roundedRect(badgeX, cardStartY, 60, 18, 3).fill(severityColor);
  doc.font(f.bold).fontSize(8).fillColor(COLORS.white);
  doc.text(finding.severity, badgeX, cardStartY + 5, { width: 60, align: 'center' });

  // Issue link (if exists)
  const issue = options?.createdIssues?.get(finding.finding_id);
  if (issue) {
    doc.font(f.regular).fontSize(8).fillColor(COLORS.link);
    doc.text(`Issue #${issue.number}`, badgeX - 80, cardStartY + 5, { link: issue.url, underline: true });
  }

  doc.moveDown(0.8);

  // Location info
  doc.font(f.semiBold).fontSize(10).fillColor(COLORS.text);
  doc.text(`${finding.location.method} ${finding.location.endpoint}`, headerX);
  doc.moveDown(0.3);

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
    doc.font(f.mono).fontSize(9).fillColor(COLORS.link);
    doc.text(fileRef, headerX, doc.y, { link: url, underline: true });
  } else {
    doc.font(f.mono).fontSize(9).fillColor(COLORS.muted);
    doc.text(fileRef, headerX);
  }

  if (finding.location.parameter) {
    doc.font(f.regular).fontSize(9).fillColor(COLORS.muted);
    doc.text(`Parameter: ${finding.location.parameter}`, headerX);
  }
  doc.moveDown(0.5);

  // Metadata chips
  const metaParts: string[] = [];
  if (finding.cvss_score) metaParts.push(`CVSS ${finding.cvss_score}`);
  if (finding.owasp) metaParts.push(finding.owasp);
  metaParts.push(finding.exploit_confidence === 'confirmed' ? '✓ Confirmed' : 'Unconfirmed');
  if (finding.monkeypatch.status === 'validated') metaParts.push('✓ Patch Validated');

  doc.font(f.regular).fontSize(8).fillColor(COLORS.muted);
  doc.text(metaParts.join('  •  '), headerX);
  doc.moveDown(0.8);

  // Description
  doc.font(f.semiBold).fontSize(9).fillColor(COLORS.subheader);
  doc.text('Description', headerX);
  doc.moveDown(0.3);
  doc.font(f.regular).fontSize(9).fillColor(COLORS.text);
  doc.text(finding.description, headerX, doc.y, { width: CONTENT_WIDTH - 32 });
  doc.moveDown(0.8);

  // Reproduction
  if (finding.reproduction) {
    doc.font(f.semiBold).fontSize(9).fillColor(COLORS.subheader);
    doc.text('Reproduction', headerX);
    doc.moveDown(0.4);

    const cmd = finding.reproduction.command.length > 250
      ? finding.reproduction.command.slice(0, 247) + '...'
      : finding.reproduction.command;

    // Code block
    const codeY = doc.y;
    doc.font(f.mono).fontSize(8);
    const codeHeight = doc.heightOfString(cmd, { width: CONTENT_WIDTH - 48 }) + 16;
    doc.rect(headerX, codeY, CONTENT_WIDTH - 32, codeHeight).fill(COLORS.codeBg);
    doc.fillColor(COLORS.text);
    doc.text(cmd, headerX + 8, codeY + 8, { width: CONTENT_WIDTH - 48 });
    doc.y = codeY + codeHeight + 8;

    doc.font(f.regular).fontSize(8).fillColor(COLORS.muted);
    doc.text(`Expected: ${finding.reproduction.expected}`, headerX);
    doc.moveDown(0.2);
    doc.font(f.regular).fontSize(8).fillColor(COLORS.CRITICAL);
    doc.text(`Actual: ${finding.reproduction.actual}`, headerX);
    doc.moveDown(0.8);
  }

  // Monkeypatch diff
  if (finding.monkeypatch.diff) {
    doc.font(f.semiBold).fontSize(9).fillColor(COLORS.subheader);
    doc.text('Monkeypatch Diff', headerX);
    doc.moveDown(0.4);

    const diffLines = finding.monkeypatch.diff.split('\n').slice(0, 8);

    for (const line of diffLines) {
      let bgColor = COLORS.codeBg;
      let textColor = COLORS.muted;
      if (line.startsWith('+') && !line.startsWith('+++')) {
        bgColor = '#DCFCE7';
        textColor = '#166534';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        bgColor = '#FEE2E2';
        textColor = '#991B1B';
      }

      const lineY = doc.y;
      doc.rect(headerX, lineY, CONTENT_WIDTH - 32, 12).fill(bgColor);
      doc.font(f.mono).fontSize(7).fillColor(textColor);
      const truncatedLine = line.length > 80 ? line.slice(0, 77) + '...' : line;
      doc.text(truncatedLine, headerX + 6, lineY + 2, { lineBreak: false });
      doc.y = lineY + 12;
    }
    doc.moveDown(0.8);
  }

  // Recommended fix
  doc.font(f.semiBold).fontSize(9).fillColor(COLORS.subheader);
  doc.text('Recommended Fix', headerX);
  doc.moveDown(0.3);
  doc.font(f.regular).fontSize(9).fillColor(COLORS.text);
  doc.text(finding.recommended_fix, headerX, doc.y, { width: CONTENT_WIDTH - 32 });
  doc.moveDown(0.5);

  // Rules violated
  if (finding.rules_violated.length > 0) {
    doc.font(f.regular).fontSize(8).fillColor(COLORS.CRITICAL);
    const rulesText = finding.rules_violated.join(', ');
    doc.text(`Rules violated: ${rulesText}`, headerX, doc.y, { width: CONTENT_WIDTH - 32 });
    doc.moveDown(0.5);
  }

  // Extend the left border to match card height
  const cardEndY = doc.y;
  doc.rect(x, cardStartY, 4, cardEndY - cardStartY).fill(severityColor);

  // Separator line
  doc.moveDown(0.5);
  doc.rect(x, doc.y, CONTENT_WIDTH, 1).fill(COLORS.border);
  doc.moveDown(1);
}

// ---------------------------------------------------------------------------
// Finding — Condensed (for Medium/Low)
// ---------------------------------------------------------------------------

function drawFindingCondensed(doc: PDFKit.PDFDocument, finding: Finding, index: number, options?: PdfReportOptions, fonts?: FontConfig) {
  const f = fonts ?? { regular: 'Helvetica', bold: 'Helvetica-Bold', semiBold: 'Helvetica-Bold', mono: 'Courier' };
  const x = MARGIN;
  const severityColor = COLORS[finding.severity as keyof typeof COLORS] || COLORS.MEDIUM;

  const cardY = doc.y;

  // Left accent bar
  doc.rect(x, cardY, 3, 70).fill(severityColor);

  // Content area
  const contentX = x + 14;

  // Title row
  doc.font(f.bold).fontSize(10).fillColor(COLORS.text);
  doc.text(`${index}. ${finding.vuln_type.toUpperCase()}`, contentX, cardY);

  // Severity badge
  const badgeX = x + CONTENT_WIDTH - 55;
  doc.roundedRect(badgeX, cardY - 2, 50, 16, 2).fill(severityColor);
  doc.font(f.bold).fontSize(7).fillColor(COLORS.white);
  doc.text(finding.severity, badgeX, cardY + 2, { width: 50, align: 'center' });

  doc.y = cardY + 18;

  // Location
  doc.font(f.semiBold).fontSize(9).fillColor(COLORS.text);
  doc.text(`${finding.location.method} ${finding.location.endpoint}`, contentX);
  doc.moveDown(0.2);

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
    doc.font(f.mono).fontSize(8).fillColor(COLORS.link);
    doc.text(fileRef, contentX, doc.y, { link: url, underline: true });
  } else {
    doc.font(f.mono).fontSize(8).fillColor(COLORS.muted);
    doc.text(fileRef, contentX);
  }
  doc.moveDown(0.3);

  // Metadata
  const parts: string[] = [];
  if (finding.cvss_score) parts.push(`CVSS ${finding.cvss_score}`);
  if (finding.owasp) parts.push(finding.owasp);
  parts.push(finding.exploit_confidence === 'confirmed' ? 'Confirmed' : 'Unconfirmed');

  doc.font(f.regular).fontSize(8).fillColor(COLORS.muted);
  doc.text(parts.join('  •  '), contentX);
  doc.moveDown(0.3);

  // Description (truncated)
  const desc = finding.description.length > 150
    ? finding.description.slice(0, 147) + '...'
    : finding.description;
  doc.font(f.regular).fontSize(8).fillColor(COLORS.text);
  doc.text(desc, contentX, doc.y, { width: CONTENT_WIDTH - 30 });

  doc.moveDown(1);

  // Light separator
  doc.rect(x + 14, doc.y, CONTENT_WIDTH - 14, 0.5).fill(COLORS.border);
  doc.moveDown(0.8);
}

// ---------------------------------------------------------------------------
// Clean Endpoints
// ---------------------------------------------------------------------------

function drawCleanEndpoints(doc: PDFKit.PDFDocument, report: MergedReport, fonts: FontConfig) {
  const x = MARGIN;

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

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.muted);
  doc.text(`${groups.size} unique endpoints passed all security tests:`, x);
  doc.moveDown(1);

  for (const [endpoint, params] of groups) {
    if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 60) {
      doc.addPage();
    }

    doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.success);
    doc.text(`✓ ${endpoint}`, x + 8);
    doc.moveDown(0.3);

    for (const p of params) {
      doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted);
      const paramLabel = p.parameter || 'all params';
      doc.text(`${paramLabel} — ${p.attack_type}`, x + 24);
      doc.moveDown(0.2);
    }
    doc.moveDown(0.5);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, fonts: FontConfig) {
  const x = MARGIN;

  doc.rect(x, doc.y, CONTENT_WIDTH, 28).fill(COLORS.header);
  doc.font(fonts.bold).fontSize(13).fillColor(COLORS.white);
  doc.text(title, x + 16, doc.y + 8, { lineBreak: false });
  doc.y += 40;
}

function drawPageFooter(doc: PDFKit.PDFDocument, page: number, total: number, runId: string, fonts: FontConfig) {
  const y = PAGE_HEIGHT - 35;
  const x = MARGIN;

  doc.save();

  // Separator line
  doc.rect(x, y - 10, CONTENT_WIDTH, 0.5).fill(COLORS.border);

  // Left: branding
  doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted);
  doc.text(`Dispatch Security Report`, x, y, { lineBreak: false });

  // Center: run ID
  doc.font(fonts.mono).fontSize(7).fillColor(COLORS.light);
  const runIdWidth = doc.widthOfString(runId);
  doc.text(runId, x + (CONTENT_WIDTH / 2) - (runIdWidth / 2), y, { lineBreak: false });

  // Right: page number
  const pageText = `${page} / ${total}`;
  doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted);
  const pageWidth = doc.widthOfString(pageText);
  doc.text(pageText, x + CONTENT_WIDTH - pageWidth, y, { lineBreak: false });

  doc.restore();
}

function computeRiskScore(report: MergedReport): number {
  const totalEndpoints = Math.max(1, report.summary.total_endpoints);
  const raw = (report.summary.critical * 10 + report.summary.high * 5 + report.summary.medium * 2 + report.summary.low * 1) / totalEndpoints;
  return Math.min(10, raw);
}
