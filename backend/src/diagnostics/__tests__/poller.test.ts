import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiagnosticsPoller } from '../poller';
import type { AgentDiagnostics } from '../../schemas/agent-diagnostics';
import fs from 'fs';
import path from 'path';
import os from 'os';

function makeDiagnostics(overrides: Partial<AgentDiagnostics> = {}): AgentDiagnostics {
  return {
    worker_id: 'worker-1',
    worker_type: 'pentester',
    dispatch_run_id: 'run-001',
    started_at: '2026-03-14T10:00:00.000Z',
    updated_at: '2026-03-14T10:01:00.000Z',
    wall_clock_seconds: 60,
    trace_length: 10,
    tool_calls: { bash: 5, read_file: 3 },
    total_tool_calls: 8,
    lines_added: 0,
    lines_removed: 0,
    unique_files_touched: [],
    repeated_calls: 0,
    error_count: 0,
    consecutive_errors: 0,
    phase: 'attack',
    findings_so_far: 0,
    last_action: 'Testing endpoint',
    ...overrides,
  };
}

describe('DiagnosticsPoller', () => {
  let tmpDir: string;
  let poller: DiagnosticsPoller;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-poller-test-'));
  });

  afterEach(() => {
    poller?.stop();
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should register and unregister workers', () => {
    poller = new DiagnosticsPoller(1_000);
    poller.registerWorker('w-1', '/tmp/w1.json');
    poller.registerWorker('w-2', '/tmp/w2.json');

    expect(poller.getRegisteredWorkers()).toEqual(['w-1', 'w-2']);

    poller.unregisterWorker('w-1');
    expect(poller.getRegisteredWorkers()).toEqual(['w-2']);
  });

  it('should poll and emit diagnostics when file exists', () => {
    poller = new DiagnosticsPoller(1_000);
    const diagPath = path.join(tmpDir, 'diagnostics.json');
    const diag = makeDiagnostics();
    fs.writeFileSync(diagPath, JSON.stringify(diag));

    const updates: AgentDiagnostics[] = [];
    poller.onUpdate((d) => updates.push(d));
    poller.registerWorker('worker-1', diagPath);

    poller.pollAll();

    expect(updates).toHaveLength(1);
    expect(updates[0].worker_id).toBe('worker-1');
    expect(updates[0].trace_length).toBe(10);
  });

  it('should skip workers with missing files', () => {
    poller = new DiagnosticsPoller(1_000);
    const updates: AgentDiagnostics[] = [];
    poller.onUpdate((d) => updates.push(d));
    poller.registerWorker('w-1', '/nonexistent/path.json');

    poller.pollAll();

    expect(updates).toHaveLength(0);
  });

  it('should skip invalid JSON gracefully', () => {
    poller = new DiagnosticsPoller(1_000);
    const diagPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(diagPath, 'not valid json{{{');

    const updates: AgentDiagnostics[] = [];
    poller.onUpdate((d) => updates.push(d));
    poller.registerWorker('w-1', diagPath);

    poller.pollAll();

    expect(updates).toHaveLength(0);
  });

  it('should skip files that fail schema validation', () => {
    poller = new DiagnosticsPoller(1_000);
    const diagPath = path.join(tmpDir, 'partial.json');
    fs.writeFileSync(diagPath, JSON.stringify({ worker_id: 'x' })); // missing required fields

    const updates: AgentDiagnostics[] = [];
    poller.onUpdate((d) => updates.push(d));
    poller.registerWorker('w-1', diagPath);

    poller.pollAll();

    expect(updates).toHaveLength(0);
  });

  it('should support multiple callbacks', () => {
    poller = new DiagnosticsPoller(1_000);
    const diagPath = path.join(tmpDir, 'diagnostics.json');
    fs.writeFileSync(diagPath, JSON.stringify(makeDiagnostics()));

    const updates1: AgentDiagnostics[] = [];
    const updates2: AgentDiagnostics[] = [];
    poller.onUpdate((d) => updates1.push(d));
    poller.onUpdate((d) => updates2.push(d));
    poller.registerWorker('w-1', diagPath);

    poller.pollAll();

    expect(updates1).toHaveLength(1);
    expect(updates2).toHaveLength(1);
  });

  it('should start and stop polling', () => {
    poller = new DiagnosticsPoller(1_000);
    const diagPath = path.join(tmpDir, 'diagnostics.json');
    fs.writeFileSync(diagPath, JSON.stringify(makeDiagnostics()));

    const updates: AgentDiagnostics[] = [];
    poller.onUpdate((d) => updates.push(d));
    poller.registerWorker('w-1', diagPath);

    poller.start();
    // Initial poll on start
    expect(updates.length).toBeGreaterThanOrEqual(1);

    const countAfterStart = updates.length;

    // Advance time to trigger another poll
    vi.advanceTimersByTime(1_000);
    expect(updates.length).toBeGreaterThan(countAfterStart);

    poller.stop();
    const countAfterStop = updates.length;

    vi.advanceTimersByTime(5_000);
    expect(updates.length).toBe(countAfterStop);
  });

  it('should not start twice', () => {
    poller = new DiagnosticsPoller(1_000);
    poller.start();
    poller.start(); // should be no-op
    poller.stop();
  });
});
