import { SlackHandlerContext, SlackAppMentionEvent, AgentProcessingResult, AgentConfig, Finding } from './types';
import { extractCommand, formatBlockKitResponse, formatErrorResponse, formatFindingsResponse } from './client';
import { runOrchestrator } from '../orchestrator/agent';
import { createSimpleIssue, createIssuesFromReport, bootstrapLabels, convertFindingToIssueFormat } from '../github/issues';
import { createLinearIssuesFromReport } from '../linear/issues';
import type { Finding as OrchestratorFinding } from '../schemas/finding-report';
import type { FindingForIssue } from '../github/types';
import path from 'path';
import fs from 'fs';

/** Lazy-loaded dd-trace; no-op when Datadog is not configured */
function getTracer(): { startSpan: (name: string, opts?: { tags?: Record<string, string> }) => { setTag: (k: string, v: unknown) => void; finish: () => void } } {
  if (process.env.DD_AGENT_HOST) {
    try {
      return require('dd-trace').default;
    } catch {
      /* dd-trace not available */
    }
  }
  return {
    startSpan: (_name, _opts) => ({
      setTag: () => {},
      finish: () => {},
    }),
  };
}

/**
 * Handle app mentions (when the bot is tagged in a message)
 * @param context Handler context from Slack
 * @param agentConfig Agent configuration
 */
export async function handleAppMention(context: SlackHandlerContext, agentConfig: AgentConfig): Promise<void> {
  const event = context.event as SlackAppMentionEvent;
  const command = extractCommand(event.text);

  console.log(`📨 App Mention from <@${event.user}>: ${command}`);

  const tracer = getTracer();
  const span = tracer.startSpan('slack.handle_app_mention', {
    tags: {
      'slack.user': event.user,
      'slack.channel': event.channel,
      command,
    },
  });

  try {
    await context.say({
      channel: event.channel,
      text: 'Processing your request...',
      thread_ts: event.ts,
    });

    const result = await processAgentCommand(command, agentConfig);

    if (result.success) {
      const blocks =
        result.findings && result.findings.length > 0
          ? formatFindingsResponse(result.findings, result.issueUrls)
          : formatBlockKitResponse('✅ Agent Response', result.response, 'Dispatch Security Agent');

      await context.say({
        channel: event.channel,
        blocks,
        thread_ts: event.ts,
        text: result.response,
      });
    } else {
      const blocks = formatErrorResponse(result.error || 'Unknown error occurred');
      await context.say({
        channel: event.channel,
        blocks,
        thread_ts: event.ts,
      });
    }

    span.setTag('execution_time_ms', result.executionTimeMs);
  } catch (error) {
    context.logger.error(`Error handling app mention: ${error}`);
    span.setTag('error', true);
    span.setTag('error.message', String(error));

    await context.say({
      channel: event.channel,
      blocks: formatErrorResponse(`An error occurred: ${String(error)}`),
      thread_ts: event.ts,
    });
  } finally {
    span.finish();
  }
}

/**
 * Handle direct messages
 */
export async function handleDirectMessage(
  context: SlackHandlerContext,
  agentConfig: AgentConfig
): Promise<void> {
  const event = context.event as any;
  const text = event.text || '';

  console.log(`💬 Direct Message from <@${event.user}>: ${text}`);

  const tracer = getTracer();
  const span = tracer.startSpan('slack.handle_direct_message', {
    tags: {
      'slack.user': event.user,
      'slack.channel': event.channel,
    },
  });

  try {
    const result = await processAgentCommand(text, agentConfig);

    if (result.success) {
      const blocks =
        result.findings && result.findings.length > 0
          ? formatFindingsResponse(result.findings, result.issueUrls)
          : formatBlockKitResponse('✅ Response', result.response, 'Dispatch Security Agent');

      await context.say({
        channel: event.channel,
        blocks,
        text: result.response,
      });
    } else {
      await context.say({
        channel: event.channel,
        blocks: formatErrorResponse(result.error || 'Unknown error'),
      });
    }

    span.setTag('execution_time_ms', result.executionTimeMs);
  } catch (error) {
    context.logger.error(`Error handling direct message: ${error}`);
    span.setTag('error', true);
    span.setTag('error.message', String(error));

    await context.say({
      channel: event.channel,
      blocks: formatErrorResponse(`An error occurred: ${String(error)}`),
    });
  } finally {
    span.finish();
  }
}

/**
 * Core agent logic - processes user commands
 */
export async function processAgentCommand(
  command: string,
  agentConfig: AgentConfig
): Promise<AgentProcessingResult> {
  const startTime = Date.now();
  const lowerCommand = command.toLowerCase();

  try {
    if (lowerCommand.includes('fix ') || lowerCommand.startsWith('fix')) {
      return await handleFixCommand(command, agentConfig);
    } else if (lowerCommand.includes('create issue') || lowerCommand.includes('github')) {
      return await handleGitHubCommand(command, agentConfig);
    } else if (lowerCommand.includes('help')) {
      return handleHelpCommand();
    } else if (lowerCommand.includes('juice')) {
      return await handleJuiceShopCommand(command, agentConfig);
    } else if (lowerCommand.includes('scan') || lowerCommand.includes('test')) {
      return await handleSecurityScan(command, agentConfig);
    } else {
      return {
        success: true,
        response: `Echo: ${command}\n\nTry "help" to see available commands.`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      success: false,
      response: '',
      error: `Agent error: ${String(error)}`,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/** Map orchestrator Finding to Slack Finding */
function toSlackFinding(f: OrchestratorFinding): Finding {
  const severity = f.severity.toLowerCase() as Finding['severity'];
  return {
    type: f.vuln_type,
    severity: severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low' ? severity : 'medium',
    description: f.description,
    endpoint: f.location?.endpoint,
    recommendation: f.recommended_fix,
  };
}

/**
 * Handle security scan - calls runOrchestrator with configured targetDir
 */
async function handleSecurityScan(command: string, agentConfig: AgentConfig): Promise<AgentProcessingResult> {
  const startTime = Date.now();

  if (!agentConfig.targetDir) {
    return {
      success: false,
      response: '',
      error: 'DISPATCH_TARGET_DIR not configured. Set it to the path of the app to scan.',
      executionTimeMs: Date.now() - startTime,
    };
  }

  const targetDir = path.resolve(agentConfig.targetDir);
  if (!fs.existsSync(targetDir)) {
    return {
      success: false,
      response: '',
      error: `Target directory not found: ${targetDir}`,
      executionTimeMs: Date.now() - startTime,
    };
  }

  const outputPath = path.join(process.cwd(), 'dispatch-output-slack.json');

  try {
    const result = await runOrchestrator({
      targetDir,
      mode: 'local',
      maxWorkers: 2,
      outputPath,
      triggeredBy: 'slack',
    });

    const mergedReport = result.mergedReport;
    if (!mergedReport || mergedReport.findings.length === 0) {
      return {
        success: true,
        response: `Security scan completed. No findings. (Routes: ${result.preRecon.route_map.length})`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const slackFindings = mergedReport.findings.map(toSlackFinding);
    let issueUrls: string[] = [];

    if (agentConfig.githubRepo && agentConfig.githubToken && mergedReport.findings.length > 0) {
      try {
        if (!process.env.GITHUB_TOKEN) process.env.GITHUB_TOKEN = agentConfig.githubToken;
        await bootstrapLabels(agentConfig.githubRepo);
        const issueFindings: FindingForIssue[] = mergedReport.findings.map(f =>
          convertFindingToIssueFormat(f, result.preRecon.dispatch_run_id)
        );
        const issues = await createIssuesFromReport(agentConfig.githubRepo, issueFindings);
        issueUrls = issues.map(i => i.url);
      } catch (err: any) {
        console.warn(`[Slack] GitHub issue creation failed: ${err.message}`);
      }
    }

    // Create Linear issues alongside GitHub issues
    let linearIssueCount = 0;
    if (agentConfig.linearApiKey && agentConfig.linearTeamId && mergedReport.findings.length > 0) {
      try {
        if (!process.env.LINEAR_API_KEY) process.env.LINEAR_API_KEY = agentConfig.linearApiKey;
        const issueFindings: FindingForIssue[] = mergedReport.findings.map(f =>
          convertFindingToIssueFormat(f, result.preRecon.dispatch_run_id)
        );
        const linearIssues = await createLinearIssuesFromReport(
          agentConfig.linearTeamId,
          issueFindings,
        );
        linearIssueCount = linearIssues.length;
        console.log(`[Slack] Created ${linearIssueCount} Linear issues`);
      } catch (err: any) {
        console.warn(`[Slack] Linear issue creation failed: ${err.message}`);
      }
    }

    const summary = mergedReport.summary;
    const parts = [
      `Security scan completed. Found ${mergedReport.findings.length} findings (${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low).`,
    ];
    if (issueUrls.length > 0) parts.push(`Created ${issueUrls.length} GitHub issues.`);
    if (linearIssueCount > 0) parts.push(`Created ${linearIssueCount} Linear issues.`);
    const response = parts.join(' ');

    return {
      success: true,
      response,
      findings: slackFindings,
      issueUrls: issueUrls.length > 0 ? issueUrls : undefined,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      response: '',
      error: `Scan failed: ${error.message}`,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Handle Juice Shop specific commands
 */
async function handleJuiceShopCommand(command: string, agentConfig: AgentConfig): Promise<AgentProcessingResult> {
  const startTime = Date.now();

  if (!agentConfig.juiceShopUrl) {
    return {
      success: false,
      response: '',
      error: 'JUICE_SHOP_URL not configured',
      executionTimeMs: Date.now() - startTime,
    };
  }

  return {
    success: true,
    response: `Connected to Juice Shop at ${agentConfig.juiceShopUrl}. Analyzing endpoints...`,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Handle GitHub create issue - uses createSimpleIssue for ad-hoc issues
 */
async function handleGitHubCommand(command: string, agentConfig: AgentConfig): Promise<AgentProcessingResult> {
  const startTime = Date.now();

  if (!agentConfig.githubToken || !agentConfig.githubRepo) {
    return {
      success: false,
      response: '',
      error: 'GitHub credentials not configured (GITHUB_TOKEN, GITHUB_REPO)',
      executionTimeMs: Date.now() - startTime,
    };
  }

  const match = command.match(/create\s+issue\s+(.+)/i);
  const issueTitle = match ? match[1].trim() : 'Security Finding';

  try {
    if (agentConfig.githubToken && !process.env.GITHUB_TOKEN) {
      process.env.GITHUB_TOKEN = agentConfig.githubToken;
    }
    const created = await createSimpleIssue(agentConfig.githubRepo, issueTitle);

    const response = `✅ *GitHub Issue Created*\n\n*Title:* ${issueTitle}\n*Issue #:* ${created.number}\n*Repository:* ${agentConfig.githubRepo}\n*URL:* ${created.url}`;

    return {
      success: true,
      response,
      issueUrls: [created.url],
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      response: '',
      error: `GitHub issue creation failed: ${error.message}`,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Handle fix command — triggers the constructor worker for a Linear issue.
 *
 * Usage: @Dispatch fix DISP-123
 */
async function handleFixCommand(command: string, agentConfig: AgentConfig): Promise<AgentProcessingResult> {
  const startTime = Date.now();

  // Extract issue identifier (e.g. "DISP-123" or a Linear UUID)
  const match = command.match(/fix\s+(\S+)/i);
  const issueId = match?.[1];

  if (!issueId) {
    return {
      success: false,
      response: '',
      error: 'Usage: `fix DISP-123` — provide a Linear issue identifier.',
      executionTimeMs: Date.now() - startTime,
    };
  }

  if (!agentConfig.githubRepo) {
    return {
      success: false,
      response: '',
      error: 'GITHUB_REPO not configured. Required for the constructor to create PRs.',
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Call the fix API endpoint (same one the "Run Dispatch Fixer" link uses)
    const apiBase = process.env.DISPATCH_API_URL || 'http://localhost:3333';
    const res = await fetch(`${apiBase}/api/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linear_issue_id: issueId,
        github_repo: agentConfig.githubRepo,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        response: '',
        error: `Fix API returned error: ${data.error ?? res.statusText}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const fixResult = data.result;
    const prUrl = fixResult?.pr?.url;
    const status = fixResult?.status ?? 'unknown';

    const response = [
      `*Fix initiated for ${issueId}*`,
      `Status: \`${status}\``,
      fixResult?.files_changed?.length
        ? `Files changed: ${fixResult.files_changed.join(', ')}`
        : null,
      prUrl ? `PR: ${prUrl}` : null,
      fixResult?.notes ? `Notes: ${fixResult.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      success: true,
      response,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      response: '',
      error: `Fix failed: ${error.message}`,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Handle help command
 */
function handleHelpCommand(): AgentProcessingResult {
  const helpText = `
*Available Commands:*

• \`scan\` - Run a security scan (requires DISPATCH_TARGET_DIR)
• \`fix DIS-123\` - Fix a Linear issue (triggers constructor agent → PR)
• \`create issue [title]\` - Create a GitHub issue
• \`juice [command]\` - Interact with Juice Shop
• \`help\` - Show this help message

*Examples:*
• "@Dispatch scan"
• "@Dispatch fix DISP-42"
• "@Dispatch create issue SQL Injection in login form"
`;

  return {
    success: true,
    response: helpText,
  };
}
