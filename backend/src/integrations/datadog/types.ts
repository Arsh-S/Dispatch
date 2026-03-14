export interface DatadogConfig {
  apiKey: string;
  applicationKey?: string;
  site: string;
  env: string;
  service: string;
}

export interface DatadogLogPayload {
  message: string;
  ddsource: string;
  ddtags: string;
  hostname: string;
  service: string;
  status: string;
}

export interface DatadogLogSearchFilter {
  query: string;
  from: string;
  to?: string;
  indexes?: string[];
}

export interface DatadogLogSearchRequest {
  filter: DatadogLogSearchFilter;
  page?: { limit: number; cursor?: string };
  sort?: 'timestamp' | '-timestamp';
}

export interface DatadogLogAttributes {
  timestamp: string;
  status: string;
  message: string;
  attributes: Record<string, unknown>;
  tags: string[];
}

export interface DatadogLogResult {
  id: string;
  type: string;
  attributes: DatadogLogAttributes;
}

export interface DatadogLogSearchResponse {
  data: DatadogLogResult[];
  meta?: { page?: { after?: string } };
}

export interface DatadogEvent {
  title: string;
  text: string;
  tags: string[];
  alert_type: 'error' | 'warning' | 'info' | 'success';
  source_type_name: string;
}

export interface DatadogMetricSeries {
  metric: string;
  type: 0 | 1 | 2 | 3;
  points: Array<{ timestamp: number; value: number }>;
  tags: string[];
}

export interface DatadogMetricsPayload {
  series: DatadogMetricSeries[];
}
