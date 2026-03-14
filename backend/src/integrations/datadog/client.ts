import {
  DatadogConfig,
  DatadogLogPayload,
  DatadogLogSearchRequest,
  DatadogLogSearchResponse,
  DatadogEvent,
  DatadogMetricsPayload,
} from './types.js';

let config: DatadogConfig | null = null;

export function initDatadog(): DatadogConfig | null {
  const apiKey = process.env.DATADOG_API_KEY;
  if (!apiKey) return null;

  config = {
    apiKey,
    applicationKey: process.env.DD_APPLICATION_KEY,
    site: process.env.DD_SITE || 'datadoghq.com',
    env: process.env.DD_ENV || 'dispatch',
    service: process.env.DD_SERVICE || 'dispatch-scanner',
  };
  return config;
}

export function getConfig(): DatadogConfig | null {
  return config;
}

export function isEnabled(): boolean {
  return config !== null;
}

export function isReadEnabled(): boolean {
  return config !== null && !!config.applicationKey;
}

function baseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'DD-API-KEY': config!.apiKey,
  };
}

function readHeaders(): Record<string, string> {
  return {
    ...baseHeaders(),
    'DD-APPLICATION-KEY': config!.applicationKey!,
  };
}

export async function sendLogs(logs: DatadogLogPayload[]): Promise<void> {
  if (!config) return;
  try {
    const resp = await fetch(
      `https://http-intake.logs.${config.site}/api/v2/logs`,
      { method: 'POST', headers: baseHeaders(), body: JSON.stringify(logs) },
    );
    if (!resp.ok) {
      console.error(`[datadog] sendLogs failed: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('[datadog] sendLogs error:', err);
  }
}

export async function searchLogs(
  request: DatadogLogSearchRequest,
): Promise<DatadogLogSearchResponse | null> {
  if (!config || !config.applicationKey) return null;
  try {
    const resp = await fetch(
      `https://api.${config.site}/api/v2/logs/events/search`,
      { method: 'POST', headers: readHeaders(), body: JSON.stringify(request) },
    );
    if (!resp.ok) {
      console.error(`[datadog] searchLogs failed: ${resp.status} ${resp.statusText}`);
      return null;
    }
    return (await resp.json()) as DatadogLogSearchResponse;
  } catch (err) {
    console.error('[datadog] searchLogs error:', err);
    return null;
  }
}

export async function sendEvent(event: DatadogEvent): Promise<void> {
  if (!config) return;
  try {
    const resp = await fetch(
      `https://api.${config.site}/api/v1/events`,
      { method: 'POST', headers: baseHeaders(), body: JSON.stringify(event) },
    );
    if (!resp.ok) {
      console.error(`[datadog] sendEvent failed: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('[datadog] sendEvent error:', err);
  }
}

export async function sendMetrics(payload: DatadogMetricsPayload): Promise<void> {
  if (!config) return;
  try {
    const resp = await fetch(
      `https://api.${config.site}/api/v2/series`,
      { method: 'POST', headers: baseHeaders(), body: JSON.stringify(payload) },
    );
    if (!resp.ok) {
      console.error(`[datadog] sendMetrics failed: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('[datadog] sendMetrics error:', err);
  }
}

export function resetConfig(): void {
  config = null;
}
