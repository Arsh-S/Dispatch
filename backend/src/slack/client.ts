import { App, LogLevel, SocketModeReceiver } from '@slack/bolt';
import { SlackConfig } from './types';

/**
 * Initialize and configure the Slack Bolt app with Socket Mode
 * @param config Slack configuration
 * @param receiver Socket Mode receiver instance
 * @returns Configured Slack App instance
 */
export function initializeSlackApp(config: SlackConfig, receiver: SocketModeReceiver): App {
  const app = new App({
    token: config.botToken,
    receiver: receiver,
    logLevel: config.debug ? LogLevel.DEBUG : LogLevel.INFO,
  });

  return app;
}

/**
 * Create and start the Socket Mode receiver
 * @param appToken App-level token (xapp-)
 * @returns Promise that resolves to the started receiver
 */
export async function createSocketModeReceiver(appToken: string): Promise<SocketModeReceiver> {
  const receiver = new SocketModeReceiver({
    appToken: appToken,
    logLevel: LogLevel.DEBUG,
  });
  return receiver;
}

/**
 * Start the Slack app using Socket Mode
 * @param receiver Socket Mode receiver instance
 * @returns Promise that resolves when receiver is started
 */
export async function startSocketModeHandler(receiver: SocketModeReceiver): Promise<SocketModeReceiver> {
  await receiver.start();
  console.log('✓ Slack Socket Mode receiver started');
  return receiver;
}

/**
 * Format a message response using Slack Block Kit
 * @param title Section title
 * @param content Main content
 * @param footer Optional footer text
 * @returns Array of Block Kit blocks
 */
export function formatBlockKitResponse(
  title: string,
  content: string,
  footer?: string
): any[] {
  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*\n${content}`,
      },
    },
    {
      type: 'divider',
    },
  ];

  if (footer) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: footer,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Format error response
 * @param error Error message
 * @returns Array of Block Kit blocks
 */
export function formatErrorResponse(error: string): any[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:warning: *Error Processing Request*\n\`\`\`${error}\`\`\``,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_Please check your input and try again_',
        },
      ],
    },
  ];
}

/**
 * Format findings response with GitHub/Linear links
 * @param findings Array of findings
 * @param issueUrls Optional issue creation URLs
 * @returns Array of Block Kit blocks
 */
export function formatFindingsResponse(findings: any[], issueUrls?: string[]): any[] {
  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*:lock: Security Findings Report*\n\nFound ${findings.length} potential issues:`,
      },
    },
    {
      type: 'divider',
    },
  ];

  // Add each finding
  findings.forEach((finding, index) => {
    const recurrenceLine = finding.consecutive_count && finding.consecutive_count >= 2
      ? `\n:repeat: _Flagged in ${finding.consecutive_count} consecutive scans${finding.escalated_from ? ` — escalated from ${finding.escalated_from}` : ''}_`
      : '';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${index + 1}. ${finding.type}* (${finding.severity.toUpperCase()})${recurrenceLine}\n${finding.description}${
          finding.recommendation ? `\n_Recommendation: ${finding.recommendation}_` : ''
        }`,
      },
    });
  });

  // Add issue links if provided
  if (issueUrls && issueUrls.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Created Issues:*\n${issueUrls.map((url, i) => `${i + 1}. <${url}|Issue ${i + 1}>`).join('\n')}`,
      },
    });
  }

  return blocks;
}

/**
 * Extract text command from Slack message
 * Removes the bot mention if present
 * @param text Raw message text from Slack
 * @returns Cleaned command text
 */
export function extractCommand(text: string): string {
  // Remove @bot-mention format: <@USERID>
  return text.replace(/<@[A-Z0-9]+>/g, '').trim();
}
