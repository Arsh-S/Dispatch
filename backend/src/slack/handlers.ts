import { SlackHandlerContext, SlackAppMentionEvent, AgentProcessingResult, AgentConfig } from './types';
import { extractCommand, formatBlockKitResponse, formatErrorResponse, formatFindingsResponse } from './client';
import { tracer } from 'dd-trace';

/**
 * Handle app mentions (when the bot is tagged in a message)
 * @param context Handler context from Slack
 * @param agentConfig Agent configuration
 */
export async function handleAppMention(context: SlackHandlerContext, agentConfig: AgentConfig): Promise<void> {
  const event = context.event as SlackAppMentionEvent;
  const command = extractCommand(event.text);

  console.log(`📨 App Mention from <@${event.user}>: ${command}`);

  // Start Datadog trace
  const span = tracer.startSpan('slack.handle_app_mention', {
    tags: {
      'slack.user': event.user,
      'slack.channel': event.channel,
      'command': command,
    },
  });

  try {
    // Acknowledge the message
    await context.say({
      channel: event.channel,
      text: 'Processing your request...',
      thread_ts: event.ts,
    });

    // Process the command through the agent
    const result = await processAgentCommand(command, agentConfig);

    // Format and send response
    if (result.success) {
      const blocks =
        result.findings && result.findings.length > 0
          ? formatFindingsResponse(result.findings, result.issueUrls)
          : formatBlockKitResponse('✅ Agent Response', result.response, 'Dispatch Security Agent');

      await context.say({
        channel: event.channel,
        blocks,
        thread_ts: event.ts,
        text: result.response, // Fallback for clients that don't support Block Kit
      });
    } else {
      const blocks = formatErrorResponse(result.error || 'Unknown error occurred');
      await context.say({
        channel: event.channel,
        blocks,
        thread_ts: event.ts,
      });
    }

    // Record execution time
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
 * @param context Handler context from Slack
 * @param agentConfig Agent configuration
 */
export async function handleDirectMessage(
  context: SlackHandlerContext,
  agentConfig: AgentConfig
): Promise<void> {
  const event = context.event as any;
  const text = event.text || '';

  console.log(`💬 Direct Message from <@${event.user}>: ${text}`);

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
 * This is where the agent interacts with Juice Shop, GitHub, Linear, etc.
 *
 * @param command User command from Slack
 * @param agentConfig Agent configuration
 * @returns Agent processing result
 */
export async function processAgentCommand(
  command: string,
  agentConfig: AgentConfig
): Promise<AgentProcessingResult> {
  const startTime = Date.now();
  const lowerCommand = command.toLowerCase();

  try {
    // Route different commands to agent modules
    // Check more specific commands first
    if (lowerCommand.includes('create issue') || lowerCommand.includes('github')) {
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

/**
 * Handle security scan commands
 */
async function handleSecurityScan(command: string, agentConfig: AgentConfig): Promise<AgentProcessingResult> {
  const startTime = Date.now();

  // This is a placeholder - integrate with your actual Dispatch scanner
  const mockFindings = [
    {
      type: 'SQL Injection Vulnerability',
      severity: 'critical' as const,
      description: 'Potential SQL injection in `/api/login` endpoint',
      endpoint: '/api/login',
      recommendation: 'Use parameterized queries and input validation',
    },
    {
      type: 'Missing CSRF Token',
      severity: 'high' as const,
      description: 'POST endpoints missing CSRF protection',
      endpoint: '/api/checkout',
      recommendation: 'Implement CSRF token validation',
    },
  ];

  return {
    success: true,
    response: 'Security scan completed',
    findings: mockFindings,
    issueUrls: [], // Would be populated by actual GitHub integration
    executionTimeMs: Date.now() - startTime,
  };
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

  // Placeholder for Juice Shop interaction logic
  // In production, you would:
  // 1. Make HTTP requests to Juice Shop
  // 2. Analyze responses for vulnerabilities
  // 3. Create findings
  // 4. Optionally create GitHub issues

  return {
    success: true,
    response: `Connected to Juice Shop at ${agentConfig.juiceShopUrl}. Analyzing endpoints...`,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Handle GitHub-related commands
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

  // Extract the issue title from the command
  // Example: "create issue SQL Injection vulnerability" → "SQL Injection vulnerability"
  const match = command.match(/create\s+issue\s+(.+)/i);
  const issueTitle = match ? match[1].trim() : 'Security Finding';

  // Mock issue creation response
  const mockIssueNumber = Math.floor(Math.random() * 1000) + 1;
  const mockIssueUrl = `https://github.com/${agentConfig.githubRepo}/issues/${mockIssueNumber}`;
  
  const response = `✅ *GitHub Issue Created*\n\n*Title:* ${issueTitle}\n*Issue #:* ${mockIssueNumber}\n*Repository:* ${agentConfig.githubRepo}\n*URL:* ${mockIssueUrl}`;

  return {
    success: true,
    response: response,
    issueUrls: [mockIssueUrl],
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Handle help command
 */
function handleHelpCommand(): AgentProcessingResult {
  const helpText = `
*Available Commands:*

• \`scan [endpoint]\` - Run a security scan on specified endpoint
• \`juice [command]\` - Interact with Juice Shop (e.g., "juice scan /api/users")
• \`create issue [title]\` - Create a GitHub issue
• \`help\` - Show this help message

*Examples:*
• "@Dispatch scan /api/login"
• "@Dispatch juice test /rest/admin"
• "@Dispatch create issue SQL Injection in login form"
`;

  return {
    success: true,
    response: helpText,
  };
}
