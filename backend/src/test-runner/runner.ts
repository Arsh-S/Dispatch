import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';
import type { TestRunReport } from '../schemas/test-run-report';
import { detectTestCommand } from './detect-command';
import { parseTestOutput } from './parsers';

const MAX_OUTPUT_BYTES = 100 * 1024; // 100KB

export interface TestRunnerOptions {
  command?: string;
  timeoutSeconds?: number;
  dispatchRunId?: string;
}

function truncate(str: string, maxBytes: number): string {
  if (Buffer.byteLength(str) <= maxBytes) return str;
  const buf = Buffer.from(str);
  return buf.subarray(0, maxBytes).toString('utf-8') + '\n\n--- output truncated at 100KB ---';
}

export function runLocalTestRunner(
  targetDir: string,
  options: TestRunnerOptions = {},
): Promise<TestRunReport> {
  const command = options.command || detectTestCommand(targetDir);
  const timeoutMs = (options.timeoutSeconds ?? 300) * 1000;
  const dispatchRunId = options.dispatchRunId ?? uuid();
  const workerId = `test-runner-${uuid().slice(0, 8)}`;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn(command, {
      cwd: targetDir,
      shell: true,
      timeout: timeoutMs,
      env: { ...process.env },
    });

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('close', (code, signal) => {
      const durationSeconds = (Date.now() - startTime) / 1000;
      const stdout = truncate(Buffer.concat(stdoutChunks).toString('utf-8'), MAX_OUTPUT_BYTES);
      const stderr = truncate(Buffer.concat(stderrChunks).toString('utf-8'), MAX_OUTPUT_BYTES);

      let status: TestRunReport['status'];
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        status = 'timeout';
      } else if (code === 0) {
        status = 'passed';
      } else if (code !== null) {
        status = 'failed';
      } else {
        status = 'error';
      }

      const parsedSummary = parseTestOutput(stdout, stderr) ?? undefined;

      resolve({
        dispatch_run_id: dispatchRunId,
        worker_id: workerId,
        completed_at: new Date().toISOString(),
        status,
        exit_code: code,
        duration_seconds: Math.round(durationSeconds * 100) / 100,
        command,
        stdout,
        stderr,
        parsed_summary: parsedSummary,
      });
    });

    child.on('error', (err) => {
      const durationSeconds = (Date.now() - startTime) / 1000;
      resolve({
        dispatch_run_id: dispatchRunId,
        worker_id: workerId,
        completed_at: new Date().toISOString(),
        status: 'error',
        exit_code: null,
        duration_seconds: Math.round(durationSeconds * 100) / 100,
        command,
        stdout: '',
        stderr: err.message,
        parsed_summary: undefined,
      });
    });
  });
}
