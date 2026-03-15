import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiagnosticsAccumulator } from '../accumulator';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('DiagnosticsAccumulator', () => {
  let tmpDir: string;
  let outputPath: string;
  let acc: DiagnosticsAccumulator;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-acc-test-'));
    outputPath = path.join(tmpDir, 'diagnostics.json');
  });

  afterEach(() => {
    acc?.stop();
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createAccumulator() {
    acc = new DiagnosticsAccumulator('worker-1', 'pentester', 'run-001', outputPath);
    return acc;
  }

  it('should create the output file on construction', () => {
    createAccumulator();
    expect(fs.existsSync(outputPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(data.worker_id).toBe('worker-1');
    expect(data.worker_type).toBe('pentester');
    expect(data.dispatch_run_id).toBe('run-001');
  });

  it('should return a valid snapshot with initial values', () => {
    createAccumulator();
    const snap = acc.getSnapshot();
    expect(snap.trace_length).toBe(0);
    expect(snap.total_tool_calls).toBe(0);
    expect(snap.lines_added).toBe(0);
    expect(snap.lines_removed).toBe(0);
    expect(snap.unique_files_touched).toEqual([]);
    expect(snap.repeated_calls).toBe(0);
    expect(snap.error_count).toBe(0);
    expect(snap.consecutive_errors).toBe(0);
    expect(snap.phase).toBe('init');
    expect(snap.findings_so_far).toBe(0);
    expect(snap.last_action).toBe('');
  });

  it('should track tool calls and increment trace length', () => {
    createAccumulator();
    acc.recordToolCall('bash');
    acc.recordToolCall('bash');
    acc.recordToolCall('read_file');

    const snap = acc.getSnapshot();
    expect(snap.trace_length).toBe(3);
    expect(snap.total_tool_calls).toBe(3);
    expect(snap.tool_calls).toEqual({ bash: 2, read_file: 1 });
  });

  it('should track repeated calls with same tool+args', () => {
    createAccumulator();
    acc.recordToolCall('bash', 'ls -la');
    acc.recordToolCall('bash', 'ls -la');
    acc.recordToolCall('bash', 'cat file.txt');

    const snap = acc.getSnapshot();
    expect(snap.repeated_calls).toBe(1);
  });

  it('should track line edits', () => {
    createAccumulator();
    acc.recordLineEdits(10, 3);
    acc.recordLineEdits(5, 2);

    const snap = acc.getSnapshot();
    expect(snap.lines_added).toBe(15);
    expect(snap.lines_removed).toBe(5);
  });

  it('should track unique files touched', () => {
    createAccumulator();
    acc.recordFileTouch('src/a.ts');
    acc.recordFileTouch('src/b.ts');
    acc.recordFileTouch('src/a.ts'); // duplicate

    const snap = acc.getSnapshot();
    expect(snap.unique_files_touched).toHaveLength(2);
    expect(snap.unique_files_touched).toContain('src/a.ts');
    expect(snap.unique_files_touched).toContain('src/b.ts');
  });

  it('should track errors and consecutive errors', () => {
    createAccumulator();
    acc.recordError();
    acc.recordError();

    let snap = acc.getSnapshot();
    expect(snap.error_count).toBe(2);
    expect(snap.consecutive_errors).toBe(2);

    acc.clearConsecutiveErrors();
    snap = acc.getSnapshot();
    expect(snap.error_count).toBe(2);
    expect(snap.consecutive_errors).toBe(0);
  });

  it('should track findings', () => {
    createAccumulator();
    acc.recordFinding();
    acc.recordFinding();

    const snap = acc.getSnapshot();
    expect(snap.findings_so_far).toBe(2);
  });

  it('should set phase and last action', () => {
    createAccumulator();
    acc.setPhase('attack');
    acc.setLastAction('Testing SQL injection on /api/users');

    const snap = acc.getSnapshot();
    expect(snap.phase).toBe('attack');
    expect(snap.last_action).toBe('Testing SQL injection on /api/users');
  });

  it('should auto-flush every 5 tool calls', () => {
    createAccumulator();
    // Initial flush happens in constructor, clear the file timestamp tracking
    const initialData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(initialData.total_tool_calls).toBe(0);

    // Make 5 tool calls to trigger auto-flush
    for (let i = 0; i < 5; i++) {
      acc.recordToolCall(`tool-${i}`);
    }

    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(data.total_tool_calls).toBe(5);
  });

  it('should not record after stop', () => {
    createAccumulator();
    acc.recordToolCall('bash');
    acc.stop();
    acc.recordToolCall('bash');

    const snap = acc.getSnapshot();
    // getSnapshot still works but recordToolCall is ignored after stop
    expect(snap.total_tool_calls).toBe(1);
  });

  it('should write atomic file (temp + rename)', () => {
    createAccumulator();
    acc.flush();

    // The output file should exist and be valid JSON
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(data.worker_id).toBe('worker-1');
  });

  it('should calculate wall_clock_seconds', () => {
    createAccumulator();
    // Advance time by 10 seconds
    vi.advanceTimersByTime(10_000);

    const snap = acc.getSnapshot();
    expect(snap.wall_clock_seconds).toBeGreaterThanOrEqual(10);
  });

  it('should support constructor worker type', () => {
    acc = new DiagnosticsAccumulator('constructor-1', 'constructor', 'run-002', outputPath);
    const snap = acc.getSnapshot();
    expect(snap.worker_type).toBe('constructor');
    expect(snap.worker_id).toBe('constructor-1');
  });
});
