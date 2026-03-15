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

// ---------------------------------------------------------------------------
// Design System - Matching Frontend (globals.css)
// ---------------------------------------------------------------------------
// Converted from OKLCH to Hex for PDFKit compatibility

const COLORS = {
  // Primary - Teal accent (oklch(0.8348 0.1302 160.9080))
  primary: '#2DD4BF',
  primaryDark: '#14B8A6',
  primaryLight: '#99F6E4',
  primaryForeground: '#134E4A',

  // Destructive - Red (oklch(0.62 0.17 32.7272))
  destructive: '#EF4444',
  destructiveLight: '#FEE2E2',
  destructiveDark: '#DC2626',

  // Backgrounds
  background: '#FAFAFA',
  foreground: '#171717',
  card: '#FFFFFF',
  cardBorder: '#E5E5E5',

  // Muted
  muted: '#F5F5F5',
  mutedForeground: '#737373',

  // Text hierarchy
  text: '#171717',
  textSecondary: '#525252',
  textMuted: '#737373',
  textLight: '#A3A3A3',

  // Accents
  accent: '#D1FAE5',
  accentForeground: '#065F46',

  // Borders
  border: '#E5E5E5',
  borderLight: '#F5F5F5',

  // Code blocks
  codeBg: '#F5F5F5',
  codeText: '#374151',

  // Links
  link: '#0EA5E9',

  // Severity colors matching frontend SeverityBadge.tsx:
  // - low/medium: bg-muted/50 text-muted-foreground (gray)
  // - high/critical: bg-destructive/10 text-destructive (red)
  severity: {
    critical: { bg: '#FEE2E2', text: '#DC2626', accent: '#EF4444' },
    high: { bg: '#FEE2E2', text: '#DC2626', accent: '#F87171' },
    medium: { bg: '#F5F5F5', text: '#737373', accent: '#A3A3A3' },
    low: { bg: '#F5F5F5', text: '#737373', accent: '#D4D4D4' },
  },

  // Success (for clean endpoints)
  success: '#10B981',
  successLight: '#D1FAE5',

  // White
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

// Page layout constants
const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN = 48;
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
      bufferPages: false,
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
        // Check if we need a new page
        if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 280) {
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
      if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 180) {
        doc.addPage();
      } else {
        doc.moveDown(1.5);
      }
      drawSectionHeader(doc, 'Medium & Low Severity Findings', fonts);

      for (let i = 0; i < mediumLowFindings.length; i++) {
        if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 100) {
          doc.addPage();
        }
        drawFindingCondensed(doc, mediumLowFindings[i], i + 1, opts, fonts);
      }
    }

    // Clean Endpoints appendix
    if (scanResult.clean_endpoints.length > 0) {
      if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 120) {
        doc.addPage();
      } else {
        doc.moveDown(1.5);
      }
      drawSectionHeader(doc, 'Clean Endpoints', fonts);
      drawCleanEndpoints(doc, scanResult, fonts);
    }

    // Note: Without buffered pages, we can't add footers to all pages
    // This is a trade-off to avoid the extra pages bug

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

  // Header with teal accent bar
  doc.rect(x, doc.y, CONTENT_WIDTH, 4).fill(COLORS.primary);
  doc.y += 20;

  // Title
  doc.font(fonts.bold).fontSize(28).fillColor(COLORS.foreground);
  doc.text('DISPATCH', x);
  doc.font(fonts.regular).fontSize(12).fillColor(COLORS.textMuted);
  doc.text('Security Scan Report', x);
  doc.moveDown(1.2);

  // Run metadata in a subtle box
  const metaY = doc.y;
  doc.rect(x, metaY, CONTENT_WIDTH, 50).fill(COLORS.muted);

  const d = new Date(report.completed_at);
  const formatted = d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.textMuted);
  doc.text(`Run ID`, x + 16, metaY + 12);
  doc.font(fonts.mono).fontSize(9).fillColor(COLORS.text);
  doc.text(report.dispatch_run_id, x + 16, metaY + 24);

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.textMuted);
  doc.text(`Completed`, x + 180, metaY + 12);
  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.text);
  doc.text(formatted, x + 180, metaY + 24);

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.textMuted);
  doc.text(`Duration`, x + 380, metaY + 12);
  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.text);
  doc.text(`${report.duration_seconds}s  •  ${report.total_workers} workers`, x + 380, metaY + 24);

  doc.y = metaY + 65;

  // Risk score and severity in cards
  const cardHeight = 100;
  const cardGap = 16;
  const cardWidth = (CONTENT_WIDTH - cardGap) / 2;
  const cardY = doc.y; // Save Y position for both cards

  // Left card: Risk Score
  const riskScore = computeRiskScore(report);
  const riskLevel = riskScore >= 8 ? 'critical' : riskScore >= 5 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
  const riskColors = COLORS.severity[riskLevel];

  drawCard(doc, x, cardY, cardWidth, cardHeight);
  doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.textMuted);
  doc.text('RISK SCORE', x + 20, cardY + 16, { lineBreak: false });

  doc.font(fonts.bold).fontSize(48).fillColor(riskColors.text);
  doc.text(riskScore.toFixed(1), x + 20, cardY + 36, { lineBreak: false });

  doc.font(fonts.semiBold).fontSize(11).fillColor(riskColors.text);
  doc.text(riskLevel.toUpperCase(), x + 110, cardY + 58, { lineBreak: false });

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.textMuted);
  doc.text('out of 10', x + 20, cardY + 82, { lineBreak: false });

  // Right card: Severity Breakdown
  const rightX = x + cardWidth + cardGap;
  drawCard(doc, rightX, cardY, cardWidth, cardHeight);
  doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.textMuted);
  doc.text('SEVERITY BREAKDOWN', rightX + 20, cardY + 16, { lineBreak: false });

  const severities = [
    { label: 'Critical', count: report.summary.critical, colors: COLORS.severity.critical },
    { label: 'High', count: report.summary.high, colors: COLORS.severity.high },
    { label: 'Medium', count: report.summary.medium, colors: COLORS.severity.medium },
    { label: 'Low', count: report.summary.low, colors: COLORS.severity.low },
  ];

  let sevY = cardY + 36;
  const barMaxWidth = cardWidth - 100;
  const maxCount = Math.max(1, ...severities.map(s => s.count));

  for (const sev of severities) {
    doc.font(fonts.regular).fontSize(9).fillColor(COLORS.text);
    doc.text(sev.label, rightX + 20, sevY, { lineBreak: false });

    const barWidth = Math.max(6, (sev.count / maxCount) * barMaxWidth * 0.7);
    doc.roundedRect(rightX + 75, sevY + 2, barWidth, 10, 2).fill(sev.colors.accent);

    doc.font(fonts.bold).fontSize(9).fillColor(COLORS.text);
    doc.text(`${sev.count}`, rightX + 80 + barWidth, sevY, { lineBreak: false });
    sevY += 16;
  }

  doc.y = cardY + cardHeight + 20;

  // Endpoint coverage - horizontal stats
  doc.font(fonts.semiBold).fontSize(11).fillColor(COLORS.text);
  doc.text('Endpoint Coverage', x, doc.y, { lineBreak: false });

  const statsY = doc.y + 20;
  const statWidth = CONTENT_WIDTH / 3;

  // Total
  doc.font(fonts.bold).fontSize(32).fillColor(COLORS.text);
  doc.text(`${report.summary.total_endpoints}`, x, statsY, { lineBreak: false });
  doc.font(fonts.regular).fontSize(10).fillColor(COLORS.textMuted);
  doc.text('Total Tested', x, statsY + 36, { lineBreak: false });

  // Vulnerable
  doc.font(fonts.bold).fontSize(32).fillColor(COLORS.destructive);
  doc.text(`${report.summary.vulnerable_endpoints}`, x + statWidth, statsY, { lineBreak: false });
  doc.font(fonts.regular).fontSize(10).fillColor(COLORS.textMuted);
  doc.text('Vulnerable', x + statWidth, statsY + 36, { lineBreak: false });

  // Clean
  doc.font(fonts.bold).fontSize(32).fillColor(COLORS.success);
  doc.text(`${report.summary.clean_endpoints}`, x + statWidth * 2, statsY, { lineBreak: false });
  doc.font(fonts.regular).fontSize(10).fillColor(COLORS.textMuted);
  doc.text('Clean', x + statWidth * 2, statsY + 36, { lineBreak: false });

  doc.y = statsY + 60;

  // Finding summary table
  if (report.findings.length > 0) {
    doc.font(fonts.semiBold).fontSize(11).fillColor(COLORS.text);
    doc.text('Finding Summary', x, doc.y, { lineBreak: false });

    const tableStartY = doc.y + 20;
    const colWidths = [30, 70, 130, 200, 65];
    const rowHeight = 28;

    // Header row
    doc.rect(x, tableStartY, CONTENT_WIDTH, rowHeight).fill(COLORS.muted);
    doc.font(fonts.semiBold).fontSize(8).fillColor(COLORS.textMuted);

    let colX = x + 10;
    doc.text('#', colX, tableStartY + 10, { lineBreak: false });
    colX += colWidths[0];
    doc.text('SEVERITY', colX, tableStartY + 10, { lineBreak: false });
    colX += colWidths[1];
    doc.text('TYPE', colX, tableStartY + 10, { lineBreak: false });
    colX += colWidths[2];
    doc.text('LOCATION', colX, tableStartY + 10, { lineBreak: false });
    colX += colWidths[3];
    doc.text('ISSUE', colX, tableStartY + 10, { lineBreak: false });

    doc.y = tableStartY + rowHeight;

    const displayFindings = report.findings.slice(0, 8);

    for (let i = 0; i < displayFindings.length; i++) {
      const f = displayFindings[i];
      const rowY = doc.y;
      const sevColors = COLORS.severity[f.severity.toLowerCase() as keyof typeof COLORS.severity] || COLORS.severity.medium;

      // Row background
      if (i % 2 === 0) {
        doc.rect(x, rowY, CONTENT_WIDTH, rowHeight).fill(COLORS.white);
      } else {
        doc.rect(x, rowY, CONTENT_WIDTH, rowHeight).fill('#FAFAFA');
      }

      // Bottom border
      doc.rect(x, rowY + rowHeight - 1, CONTENT_WIDTH, 1).fill(COLORS.borderLight);

      const cellY = rowY + 9;
      colX = x + 10;

      // Number
      doc.font(fonts.regular).fontSize(9).fillColor(COLORS.textMuted);
      doc.text(`${i + 1}`, colX, cellY, { lineBreak: false });
      colX += colWidths[0];

      // Severity badge
      const badgeWidth = 55;
      doc.roundedRect(colX, cellY - 2, badgeWidth, 16, 3).fill(sevColors.bg);
      doc.font(fonts.semiBold).fontSize(7).fillColor(sevColors.text);
      doc.text(f.severity, colX + 4, cellY + 2, { lineBreak: false });
      colX += colWidths[1];

      // Type
      doc.font(fonts.regular).fontSize(9).fillColor(COLORS.text);
      const vulnType = f.vuln_type.length > 20 ? f.vuln_type.slice(0, 18) + '…' : f.vuln_type;
      doc.text(vulnType, colX, cellY, { lineBreak: false });
      colX += colWidths[2];

      // Location
      const locDisplay = f.location.line > 0
        ? `${f.location.file}:${f.location.line}`
        : f.location.file;
      const locTruncated = locDisplay.length > 32 ? '…' + locDisplay.slice(-30) : locDisplay;
      doc.font(fonts.mono).fontSize(8).fillColor(COLORS.link);
      doc.text(locTruncated, colX, cellY, { lineBreak: false });
      colX += colWidths[3];

      // Issue
      const issue = options?.createdIssues?.get(f.finding_id);
      if (issue) {
        doc.font(fonts.semiBold).fontSize(9).fillColor(COLORS.link);
        doc.text(`#${issue.number}`, colX, cellY, { lineBreak: false });
      } else {
        doc.font(fonts.regular).fontSize(9).fillColor(COLORS.textLight);
        doc.text('—', colX, cellY, { lineBreak: false });
      }

      doc.y = rowY + rowHeight;
    }

    if (report.findings.length > 8) {
      doc.moveDown(0.3);
      doc.font(fonts.regular).fontSize(9).fillColor(COLORS.textMuted);
      doc.text(`+ ${report.findings.length - 8} more findings`, x);
    }
  }

  // Worker errors
  if (report.worker_errors.length > 0) {
    doc.moveDown(1);

    const errY = doc.y;
    doc.rect(x, errY, CONTENT_WIDTH, 40 + (report.worker_errors.length * 16)).fill(COLORS.destructiveLight);

    doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.destructive);
    doc.text(`Worker Errors (${report.worker_errors.length})`, x + 12, errY + 10);

    let errLineY = errY + 28;
    for (const err of report.worker_errors.slice(0, 3)) {
      doc.font(fonts.mono).fontSize(8).fillColor(COLORS.destructiveDark);
      const errText = err.error.length > 70 ? err.error.slice(0, 67) + '...' : err.error;
      doc.text(`${err.worker_id}: ${errText}`, x + 12, errLineY);
      errLineY += 14;
    }

    doc.y = errLineY + 8;
  }
}

// ---------------------------------------------------------------------------
// Finding — Full Detail (for Critical/High)
// ---------------------------------------------------------------------------

function drawFindingFull(doc: PDFKit.PDFDocument, finding: Finding, index: number, options?: PdfReportOptions, fonts?: FontConfig) {
  const f = fonts ?? { regular: 'Helvetica', bold: 'Helvetica-Bold', semiBold: 'Helvetica-Bold', mono: 'Courier' };
  const x = MARGIN;
  const sevColors = COLORS.severity[finding.severity.toLowerCase() as keyof typeof COLORS.severity] || COLORS.severity.medium;

  const cardStartY = doc.y;

  // Card background
  doc.rect(x, cardStartY, CONTENT_WIDTH, 4).fill(sevColors.accent);

  // Content area
  const contentX = x + 16;
  const contentWidth = CONTENT_WIDTH - 32;
  doc.y = cardStartY + 16;

  // Header: number, title, badge
  doc.font(f.bold).fontSize(13).fillColor(COLORS.text);
  doc.text(`${index}. ${finding.vuln_type}`, contentX, doc.y, { width: contentWidth - 80 });

  // Severity badge
  const badgeX = x + CONTENT_WIDTH - 70;
  doc.roundedRect(badgeX, cardStartY + 14, 58, 20, 4).fill(sevColors.bg);
  doc.font(f.bold).fontSize(9).fillColor(sevColors.text);
  doc.text(finding.severity, badgeX + 6, cardStartY + 20);

  doc.moveDown(0.6);

  // Location
  doc.font(f.semiBold).fontSize(10).fillColor(COLORS.text);
  doc.text(`${finding.location.method} ${finding.location.endpoint}`, contentX);
  doc.moveDown(0.2);

  const fileRef = finding.location.line > 0
    ? `${finding.location.file}:${finding.location.line}`
    : finding.location.file;

  doc.font(f.mono).fontSize(9).fillColor(COLORS.link);
  doc.text(fileRef, contentX);

  if (finding.location.parameter) {
    doc.font(f.regular).fontSize(9).fillColor(COLORS.textMuted);
    doc.text(`Parameter: ${finding.location.parameter}`, contentX);
  }
  doc.moveDown(0.5);

  // Metadata line
  const metaParts: string[] = [];
  if (finding.cvss_score) metaParts.push(`CVSS ${finding.cvss_score}`);
  if (finding.owasp) metaParts.push(finding.owasp);
  metaParts.push(finding.exploit_confidence === 'confirmed' ? 'Confirmed' : 'Unconfirmed');
  if (finding.monkeypatch.status === 'validated') metaParts.push('Patch Validated');

  doc.font(f.regular).fontSize(8).fillColor(COLORS.textMuted);
  doc.text(metaParts.join('  •  '), contentX);
  doc.moveDown(0.8);

  // Description
  doc.font(f.semiBold).fontSize(10).fillColor(COLORS.text);
  doc.text('Description', contentX);
  doc.moveDown(0.3);
  doc.font(f.regular).fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(finding.description, contentX, doc.y, { width: contentWidth });
  doc.moveDown(0.8);

  // Reproduction
  if (finding.reproduction) {
    doc.font(f.semiBold).fontSize(10).fillColor(COLORS.text);
    doc.text('Reproduction', contentX);
    doc.moveDown(0.4);

    const cmd = finding.reproduction.command.length > 200
      ? finding.reproduction.command.slice(0, 197) + '...'
      : finding.reproduction.command;

    // Code block
    const codeY = doc.y;
    doc.font(f.mono).fontSize(8);
    const codeHeight = Math.min(60, doc.heightOfString(cmd, { width: contentWidth - 20 }) + 16);
    doc.roundedRect(contentX, codeY, contentWidth, codeHeight, 4).fill(COLORS.codeBg);
    doc.fillColor(COLORS.codeText);
    doc.text(cmd, contentX + 10, codeY + 8, { width: contentWidth - 20 });
    doc.y = codeY + codeHeight + 8;

    doc.font(f.regular).fontSize(8).fillColor(COLORS.textMuted);
    doc.text(`Expected: ${finding.reproduction.expected}`, contentX);
    doc.font(f.regular).fontSize(8).fillColor(COLORS.destructive);
    doc.text(`Actual: ${finding.reproduction.actual}`, contentX);
    doc.moveDown(0.6);
  }

  // Monkeypatch diff
  if (finding.monkeypatch.diff) {
    doc.font(f.semiBold).fontSize(10).fillColor(COLORS.text);
    doc.text('Monkeypatch Diff', contentX);
    doc.moveDown(0.3);

    const diffLines = finding.monkeypatch.diff.split('\n').slice(0, 6);
    const lineHeight = 14;

    for (const line of diffLines) {
      let bgColor = COLORS.codeBg;
      let textColor = COLORS.textMuted;

      if (line.startsWith('+') && !line.startsWith('+++')) {
        bgColor = '#D1FAE5';
        textColor = '#065F46';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        bgColor = COLORS.destructiveLight;
        textColor = COLORS.destructiveDark;
      }

      const lineY = doc.y;
      doc.rect(contentX, lineY, contentWidth, lineHeight).fill(bgColor);
      doc.font(f.mono).fontSize(8).fillColor(textColor);
      const truncLine = line.length > 70 ? line.slice(0, 67) + '...' : line;
      doc.text(truncLine, contentX + 8, lineY + 3);
      doc.y = lineY + lineHeight;
    }
    doc.moveDown(0.6);
  }

  // Recommended fix
  doc.font(f.semiBold).fontSize(10).fillColor(COLORS.text);
  doc.text('Recommended Fix', contentX);
  doc.moveDown(0.2);
  doc.font(f.regular).fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(finding.recommended_fix, contentX, doc.y, { width: contentWidth });
  doc.moveDown(0.4);

  // Rules violated
  if (finding.rules_violated.length > 0) {
    doc.font(f.regular).fontSize(8).fillColor(COLORS.destructive);
    const rulesText = finding.rules_violated.slice(0, 2).join(', ');
    doc.text(`Rules violated: ${rulesText}`, contentX);
  }

  doc.moveDown(1.2);

  // Bottom border
  doc.rect(x, doc.y, CONTENT_WIDTH, 1).fill(COLORS.border);
  doc.moveDown(0.8);
}

// ---------------------------------------------------------------------------
// Finding — Condensed (for Medium/Low)
// ---------------------------------------------------------------------------

function drawFindingCondensed(doc: PDFKit.PDFDocument, finding: Finding, index: number, options?: PdfReportOptions, fonts?: FontConfig) {
  const f = fonts ?? { regular: 'Helvetica', bold: 'Helvetica-Bold', semiBold: 'Helvetica-Bold', mono: 'Courier' };
  const x = MARGIN;
  const sevColors = COLORS.severity[finding.severity.toLowerCase() as keyof typeof COLORS.severity] || COLORS.severity.medium;

  const cardY = doc.y;
  const contentX = x + 12;

  // Left accent
  doc.rect(x, cardY, 3, 65).fill(sevColors.accent);

  // Title row
  doc.font(f.semiBold).fontSize(11).fillColor(COLORS.text);
  doc.text(`${index}. ${finding.vuln_type}`, contentX, cardY + 4, { width: CONTENT_WIDTH - 100 });

  // Severity badge
  const badgeX = x + CONTENT_WIDTH - 60;
  doc.roundedRect(badgeX, cardY + 2, 50, 16, 3).fill(sevColors.bg);
  doc.font(f.semiBold).fontSize(7).fillColor(sevColors.text);
  doc.text(finding.severity, badgeX + 6, cardY + 6);

  doc.y = cardY + 22;

  // Location
  doc.font(f.regular).fontSize(9).fillColor(COLORS.text);
  doc.text(`${finding.location.method} ${finding.location.endpoint}`, contentX);

  const fileRef = finding.location.line > 0
    ? `${finding.location.file}:${finding.location.line}`
    : finding.location.file;
  doc.font(f.mono).fontSize(8).fillColor(COLORS.link);
  doc.text(fileRef, contentX);
  doc.moveDown(0.2);

  // Metadata
  const parts: string[] = [];
  if (finding.cvss_score) parts.push(`CVSS ${finding.cvss_score}`);
  if (finding.owasp) parts.push(finding.owasp);
  parts.push(finding.exploit_confidence === 'confirmed' ? 'Confirmed' : 'Unconfirmed');

  doc.font(f.regular).fontSize(8).fillColor(COLORS.textMuted);
  doc.text(parts.join('  •  '), contentX);

  doc.y = cardY + 75;

  // Separator
  doc.rect(x, doc.y, CONTENT_WIDTH, 1).fill(COLORS.borderLight);
  doc.moveDown(0.6);
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

  doc.font(fonts.regular).fontSize(9).fillColor(COLORS.textMuted);
  doc.text(`${groups.size} endpoints passed all security tests`, x);
  doc.moveDown(0.8);

  for (const [endpoint, params] of groups) {
    if (doc.y > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 50) {
      doc.addPage();
    }

    // Endpoint with checkmark
    doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.success);
    doc.text(`✓ ${endpoint}`, x + 8);
    doc.moveDown(0.2);

    for (const p of params) {
      doc.font(fonts.regular).fontSize(8).fillColor(COLORS.textMuted);
      const paramLabel = p.parameter || 'all';
      doc.text(`${paramLabel} — ${p.attack_type}`, x + 24);
    }
    doc.moveDown(0.5);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  doc.roundedRect(x, y, width, height, 6)
    .fill(COLORS.white);
  doc.roundedRect(x, y, width, height, 6)
    .strokeColor(COLORS.cardBorder)
    .stroke();
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, fonts: FontConfig) {
  const x = MARGIN;

  doc.rect(x, doc.y, CONTENT_WIDTH, 32).fill(COLORS.foreground);
  doc.font(fonts.bold).fontSize(12).fillColor(COLORS.white);
  doc.text(title, x + 16, doc.y + 10);
  doc.y += 44;
}

function drawPageFooter(doc: PDFKit.PDFDocument, page: number, total: number, runId: string, fonts: FontConfig) {
  const y = PAGE_HEIGHT - 32;
  const x = MARGIN;

  doc.save();

  // Top border
  doc.rect(x, y - 8, CONTENT_WIDTH, 1).fill(COLORS.border);

  // Left: branding with accent
  doc.font(fonts.semiBold).fontSize(8).fillColor(COLORS.primary);
  doc.text('DISPATCH', x, y);
  doc.font(fonts.regular).fontSize(8).fillColor(COLORS.textMuted);
  doc.text(' Security Report', x + 50, y);

  // Center: run ID
  doc.font(fonts.mono).fontSize(7).fillColor(COLORS.textLight);
  const runIdWidth = doc.widthOfString(runId);
  doc.text(runId, x + (CONTENT_WIDTH / 2) - (runIdWidth / 2), y);

  // Right: page number
  const pageText = `${page} / ${total}`;
  doc.font(fonts.regular).fontSize(8).fillColor(COLORS.textMuted);
  const pageWidth = doc.widthOfString(pageText);
  doc.text(pageText, x + CONTENT_WIDTH - pageWidth, y);

  doc.restore();
}

function computeRiskScore(report: MergedReport): number {
  const totalEndpoints = Math.max(1, report.summary.total_endpoints);
  const raw = (report.summary.critical * 10 + report.summary.high * 5 + report.summary.medium * 2 + report.summary.low * 1) / totalEndpoints;
  return Math.min(10, raw);
}
