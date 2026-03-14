export interface DispatchLogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  source: string;
  message: string;
  stack?: string;
  dispatch_worker_id?: string;
  dispatch_run_id?: string;
}

export interface DispatchLogResponse {
  worker_id: string;
  log_count: number;
  logs: DispatchLogEntry[];
}
