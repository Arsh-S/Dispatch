import { Request, Response } from 'express';

// Slack Event Types
export interface SlackEvent {
  type: string;
  user?: string;
  channel?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
}

export interface SlackAppMentionEvent extends SlackEvent {
  type: 'app_mention';
  user: string;
  channel: string;
  text: string;
  ts: string;
  thread_ts?: string;
}

export interface SlackMessageEvent extends SlackEvent {
  type: 'message';
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  subtype?: string;
}

// Slack Message Response Types
export interface SlackBlockKitBlock {
  type: string;
  [key: string]: any;
}

export interface SlackMessage {
  channel: string;
  blocks?: SlackBlockKitBlock[];
  text?: string;
  thread_ts?: string;
}

// Agent Processing Result
export interface AgentProcessingResult {
  success: boolean;
  response: string;
  findings?: Finding[];
  issueUrls?: string[];
  error?: string;
  executionTimeMs?: number;
}

export interface Finding {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  endpoint?: string;
  recommendation?: string;
}

// Slack Handler Context
export interface SlackHandlerContext {
  event: SlackEvent;
  say: (message: SlackMessage | string) => Promise<void>;
  client: any; // SlackClient from slack-bolt
  logger: any; // Logger from slack-bolt
}

// Configuration
export interface SlackConfig {
  botToken: string;
  appToken: string;
  slackNotificationChannel?: string;
  agentName: string;
  debug: boolean;
}

export interface AgentConfig {
  githubToken?: string;
  githubRepo?: string;
  juiceShopUrl?: string;
  linearApiKey?: string;
  linearTeamId?: string;
}

export interface ObservabilityConfig {
  sentryDsn?: string;
  ddAgentHost?: string;
  ddAgentPort?: number;
  ddService?: string;
  ddEnv?: string;
  ddTraceSampleRate?: number;
}
