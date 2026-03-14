import dotenv from 'dotenv';
import { App } from '@slack/bolt';
import { createSocketModeReceiver, initializeSlackApp, startSocketModeHandler } from './client';
import { handleAppMention, handleDirectMessage } from './handlers';
import { SlackConfig, AgentConfig, ObservabilityConfig } from './types';

// Load environment variables
dotenv.config();

/**
 * Initialize observability (Sentry and Datadog)
 */
function initializeObservability(): void {
  // Initialize Sentry for error tracking
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
        integrations: [new Sentry.Integrations.Http({ tracing: true })],
      });
      console.log('✓ Sentry initialized');
    } catch (error) {
      console.warn('⚠ Sentry not available, skipping initialization');
    }
  }

  // Initialize Datadog tracing
  if (process.env.DD_AGENT_HOST) {
    try {
      const tracer = require('dd-trace').default;
      tracer.init({
        hostname: process.env.DD_AGENT_HOST || 'localhost',
        port: parseInt(process.env.DD_AGENT_PORT || '8126'),
        service: process.env.DD_SERVICE || 'dispatch-slack-agent',
        env: process.env.DD_ENV || 'development',
        tracesSampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0'),
      });
      console.log('✓ Datadog tracing initialized');
    } catch (error) {
      console.warn('⚠ Datadog not available, skipping initialization');
    }
  }
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfiguration(): {
  slackConfig: SlackConfig;
  agentConfig: AgentConfig;
  observabilityConfig: ObservabilityConfig;
} {
  const slackConfig: SlackConfig = {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
    slackNotificationChannel: process.env.SLACK_NOTIFICATION_CHANNEL,
    agentName: process.env.AGENT_NAME || 'Dispatch Security Agent',
    debug: process.env.DEBUG === 'true',
  };

  const agentConfig: AgentConfig = {
    githubToken: process.env.GITHUB_TOKEN,
    githubRepo: process.env.GITHUB_REPO,
    juiceShopUrl: process.env.JUICE_SHOP_URL,
    linearApiKey: process.env.LINEAR_API_KEY,
    linearTeamId: process.env.LINEAR_TEAM_ID,
    targetDir: process.env.DISPATCH_TARGET_DIR,
  };

  const observabilityConfig: ObservabilityConfig = {
    sentryDsn: process.env.SENTRY_DSN,
    ddAgentHost: process.env.DD_AGENT_HOST,
    ddAgentPort: parseInt(process.env.DD_AGENT_PORT || '8126'),
    ddService: process.env.DD_SERVICE,
    ddEnv: process.env.DD_ENV,
    ddTraceSampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0'),
  };

  return { slackConfig, agentConfig, observabilityConfig };
}

/**
 * Validate required configuration
 */
function validateConfiguration(slackConfig: SlackConfig): void {
  const errors: string[] = [];

  if (!slackConfig.botToken) {
    errors.push('SLACK_BOT_TOKEN is required');
  }
  if (!slackConfig.appToken) {
    errors.push('SLACK_APP_TOKEN is required');
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error('\nPlease set the required environment variables in your .env file');
    process.exit(1);
  }

  console.log('✓ Configuration validated');
}

/**
 * Register event handlers
 */
function registerEventHandlers(app: App, agentConfig: AgentConfig): void {
  // Handle app mentions (@bot command)
  app.event('app_mention', async ({ event, say, client, logger }) => {
    try {
      console.log('🔔 Received app_mention event:', event.text);
      await handleAppMention({ event, say: say as any, client, logger }, agentConfig);
      console.log('✓ App mention handled successfully');
    } catch (error) {
      console.error('❌ Error handling app mention:', error);
    }
  });

  // Handle direct messages
  app.message(async ({ event, say, client, logger }) => {
    try {
      // Only handle direct messages (DMs)
      if (event.channel && event.channel.startsWith('D')) {
        console.log('💬 Received direct message:', (event as any).text);
        await handleDirectMessage({ event, say: say as any, client, logger }, agentConfig);
        console.log('✓ Direct message handled successfully');
      }
    } catch (error) {
      console.error('❌ Error handling direct message:', error);
    }
  });

  // Error handling
  app.error(async (error) => {
    console.error('❌ Slack error:', error);
    // Optionally report to Sentry
    try {
      const Sentry = require('@sentry/node');
      Sentry.captureException(error);
    } catch (e) {
      // Sentry not available
    }
  });

  console.log('✓ Event handlers registered');
}

/**
 * Main entry point - Start the Slack agent
 */
export async function startSlackAgent(): Promise<void> {
  console.log('🚀 Starting Dispatch Slack Agent...\n');

  try {
    // Initialize observability
    initializeObservability();

    // Load configuration
    const { slackConfig, agentConfig, observabilityConfig } = loadConfiguration();

    // Validate configuration
    validateConfiguration(slackConfig);

    // Create Socket Mode receiver
    console.log('📡 Creating Socket Mode receiver...');
    const receiver = await createSocketModeReceiver(slackConfig.appToken);

    // Initialize Slack app with the receiver
    console.log('🔧 Initializing Slack app...');
    const app = initializeSlackApp(slackConfig, receiver);

    // Register event handlers
    registerEventHandlers(app, agentConfig);

    // Start Socket Mode
    console.log('🔌 Starting Socket Mode connection...');
    const handler = await startSocketModeHandler(receiver);

    console.log('\n✨ Dispatch Slack Agent is running!');
    console.log(`Agent Name: ${slackConfig.agentName}`);
    if (agentConfig.juiceShopUrl) console.log(`Juice Shop: ${agentConfig.juiceShopUrl}`);
    if (agentConfig.githubRepo) console.log(`GitHub Repo: ${agentConfig.githubRepo}`);
    console.log('\nListening for messages... (Press Ctrl+C to stop)\n');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n⏹ Stopping Slack agent...');
      await handler.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start Slack agent:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  startSlackAgent();
}

export { SlackConfig, AgentConfig, ObservabilityConfig };
