/**
 * Generic Claude agent runner.
 *
 * Wraps the `claude` CLI tool (Claude Code) in a Node.js child process,
 * feeds it a system prompt + task prompt, collects stdout, and validates
 * the output JSON against a Zod output schema.
 *
 * Principles:
 * - Schemas are the contract — derives the JSON schema from Zod at runtime via zod-to-json-schema.
 * - Always uses .safeParse(), never .parse().
 * - Output schemas must have no .optional() — only .default() — so the validated
 *   object is always fully-typed without undefined fields.
 */

import { spawn, ChildProcess } from 'child_process';
import { z, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface ClaudeAgentOptions<TOutput extends ZodTypeAny> {
  /** System-level instructions passed as --system-prompt */
  systemPrompt: string;
  /** Task-level prompt (the user turn) */
  taskPrompt: string;
  /** Zod schema for the expected JSON output */
  outputSchema: TOutput;
  /** Maximum time (ms) to wait for Claude to respond. Default: 120_000 (2 min). */
  timeoutMs?: number;
  /** Working directory for the claude process. Default: process.cwd(). */
  cwd?: string;
  /** Extra environment variables forwarded to the claude subprocess. */
  env?: Record<string, string>;
  /**
   * Called with the ChildProcess immediately after spawn.
   * Allows the caller (e.g. WorkerSupervisor) to register the process
   * for monitoring and kill control before it finishes.
   */
  onSpawn?: (child: ChildProcess) => void;
}

export interface ClaudeAgentResult<T> {
  success: boolean;
  data?: T;
  /** Raw text output from Claude, useful for debugging parse failures. */
  rawOutput?: string;
  error?: string;
}

/**
 * Run a Claude Code agent subprocess, extract the first JSON block from
 * its output, and validate against `outputSchema`.
 *
 * Claude is invoked with:
 *   claude --print --output-format json -p "<taskPrompt>"
 *
 * The JSON schema derived from `outputSchema` is appended to the task prompt
 * so Claude knows the expected output format.
 */
export async function runClaudeAgent<TOutput extends ZodTypeAny>(
  options: ClaudeAgentOptions<TOutput>,
): Promise<ClaudeAgentResult<z.infer<TOutput>>> {
  const { systemPrompt, taskPrompt, outputSchema, timeoutMs = 120_000, cwd = process.cwd(), env, onSpawn } = options;

  // Derive JSON schema for the output so Claude can format its response
  const jsonSchema = zodToJsonSchema(outputSchema, { name: 'Output', errorMessages: false });

  const fullTaskPrompt = [
    taskPrompt,
    '',
    '---',
    'Respond with ONLY a valid JSON object that conforms to this schema. No markdown fences, no explanation.',
    'JSON Schema:',
    JSON.stringify(jsonSchema, null, 2),
  ].join('\n');

  const mergedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
  };

  let rawOutput = '';
  let stderrOutput = '';

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'claude',
        [
          '--print',
          '--output-format', 'text',
          '--max-turns', '1000',
          '--system-prompt', systemPrompt,
          '-p', fullTaskPrompt,
        ],
        {
          cwd,
          env: mergedEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        },
      );

      // Notify caller so it can register with the supervisor
      onSpawn?.(child);

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Claude agent timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        rawOutput += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 || rawOutput.trim().length > 0) {
          resolve();
        } else {
          reject(new Error(`Claude process exited with code ${code}. stderr: ${stderrOutput.slice(0, 500)}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message, rawOutput };
  }

  // Extract JSON from output — Claude sometimes wraps in markdown fences
  const extracted = extractJson(rawOutput);
  if (!extracted) {
    return {
      success: false,
      error: `Could not extract JSON from Claude output. Output was: ${rawOutput.slice(0, 500)}`,
      rawOutput,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `JSON.parse failed: ${message}`, rawOutput };
  }

  const result = outputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: `Schema validation failed: ${result.error.message}`,
      rawOutput,
    };
  }

  return { success: true, data: result.data as z.infer<TOutput>, rawOutput };
}

/**
 * Extract the first JSON object or array from a string.
 * Handles markdown code fences (```json ... ```) and bare JSON.
 */
function extractJson(text: string): string | null {
  // Try to strip markdown fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Find first { or [ and try to extract balanced JSON
  const startBrace = text.indexOf('{');
  const startBracket = text.indexOf('[');

  let start: number;
  let openChar: string;
  let closeChar: string;

  if (startBrace === -1 && startBracket === -1) return null;

  if (startBrace === -1) {
    start = startBracket;
    openChar = '[';
    closeChar = ']';
  } else if (startBracket === -1) {
    start = startBrace;
    openChar = '{';
    closeChar = '}';
  } else {
    start = Math.min(startBrace, startBracket);
    openChar = text[start] === '{' ? '{' : '[';
    closeChar = openChar === '{' ? '}' : ']';
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}
