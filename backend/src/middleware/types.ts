export interface DispatchLogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  source: string;
  message: string;
  stack?: string;
}

export interface DispatchLogResponse {
  worker_id: string;
  log_count: number;
  logs: DispatchLogEntry[];
}
