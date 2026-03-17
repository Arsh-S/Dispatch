import { describe, it, expect } from 'vitest';
import { TaskAssignmentSchema } from '../task-assignment';

describe('TaskAssignmentSchema', () => {
  const validAssignment = {
    dispatch_run_id: 'dispatch-run-abc12',
    worker_id: 'worker-sql-injection-users-f3a',
    assigned_at: '2026-03-14T10:00:00.000Z',
    timeout_seconds: 300,
    target: {
      file: 'src/routes/users.ts',
      endpoint: '/api/users',
      method: 'GET',
      parameters: ['id', 'name'],
    },
    attack_type: 'sql-injection',
    context: {
      relevant_files: ['src/db.ts', 'src/auth.ts'],
      rules_md: ['Always use parameterized queries'],
    },
    app_config: {
      runtime: 'node',
      install: 'pnpm install',
      start: 'pnpm dev',
      port: 3000,
    },
    briefing: 'SQL injection detected in users route handler.',
  };

  it('should parse a valid task assignment', () => {
    const result = TaskAssignmentSchema.parse(validAssignment);
    expect(result.dispatch_run_id).toBe('dispatch-run-abc12');
    expect(result.worker_id).toBe('worker-sql-injection-users-f3a');
    expect(result.target.file).toBe('src/routes/users.ts');
    expect(result.attack_type).toBe('sql-injection');
  });

  it('should apply default values', () => {
    const minimal = {
      dispatch_run_id: 'run-1',
      worker_id: 'w-1',
      assigned_at: '2026-03-14T10:00:00.000Z',
      target: {
        file: 'src/routes/users.ts',
        endpoint: '/api/users',
        method: 'GET',
      },
      attack_type: 'xss',
      context: {
        relevant_files: [],
      },
      app_config: {
        runtime: 'node',
        install: 'npm install',
        start: 'npm start',
        port: 3000,
      },
      briefing: 'XSS test',
    };
    const result = TaskAssignmentSchema.parse(minimal);
    expect(result.timeout_seconds).toBe(600);
    expect(result.target.parameters).toEqual([]);
    expect(result.context.rules_md).toEqual([]);
    expect(result.app_config.env).toEqual({});
  });

  it('should reject missing required fields', () => {
    expect(() => TaskAssignmentSchema.parse({})).toThrow();
    expect(() => TaskAssignmentSchema.parse({ dispatch_run_id: 'x' })).toThrow();
  });

  it('should accept optional line_range tuple', () => {
    const withLineRange = {
      ...validAssignment,
      target: {
        ...validAssignment.target,
        line_range: [10, 50],
      },
    };
    const result = TaskAssignmentSchema.parse(withLineRange);
    expect(result.target.line_range).toEqual([10, 50]);
  });

  it('should accept optional api_keys and developer_notes', () => {
    const withOptionals = {
      ...validAssignment,
      context: {
        ...validAssignment.context,
        api_keys: { auth_token: 'Bearer abc123' },
        developer_notes: 'Focus on the /users/:id endpoint',
      },
    };
    const result = TaskAssignmentSchema.parse(withOptionals);
    expect(result.context.api_keys).toEqual({ auth_token: 'Bearer abc123' });
    expect(result.context.developer_notes).toBe('Focus on the /users/:id endpoint');
  });
});
