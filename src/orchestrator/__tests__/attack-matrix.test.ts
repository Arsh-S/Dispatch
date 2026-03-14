import { describe, it, expect } from 'vitest';
import { buildAttackMatrix, createTaskAssignments } from '../attack-matrix';
import { PreReconDeliverable } from '../../schemas/pre-recon-deliverable';
import fs from 'fs';
import path from 'path';
import os from 'os';

function makePreRecon(overrides: Partial<PreReconDeliverable> = {}): PreReconDeliverable {
  return {
    dispatch_run_id: 'test-run-001',
    completed_at: '2026-03-14T10:00:00.000Z',
    route_map: [
      {
        endpoint: 'GET /api/users',
        method: 'GET',
        handler_file: 'src/routes/users.ts',
        handler_line: 10,
        middleware: [],
        parameters: [{ name: 'id', source: 'params', type: 'string' }],
      },
      {
        endpoint: 'POST /api/login',
        method: 'POST',
        handler_file: 'src/routes/auth.ts',
        handler_line: 5,
        middleware: [],
        parameters: [
          { name: 'username', source: 'body', type: 'string' },
          { name: 'password', source: 'body', type: 'string' },
        ],
      },
    ],
    risk_signals: [
      {
        file: 'src/routes/users.ts',
        line: 15,
        pattern: 'raw-sql-concatenation',
        snippet: 'db.query(`SELECT * FROM users WHERE id = ${req.params.id}`)',
        suggested_attack_types: ['sql-injection'],
      },
      {
        file: 'src/routes/users.ts',
        line: 20,
        pattern: 'missing-auth-middleware',
        snippet: 'router.get("/users", async (req, res) => {',
        suggested_attack_types: ['broken-auth', 'idor'],
      },
      {
        file: 'src/routes/auth.ts',
        line: 12,
        pattern: 'hardcoded-secret',
        snippet: 'const secret = "supersecretkey12345"',
        suggested_attack_types: ['secrets-exposure'],
      },
    ],
    dependency_graph: {
      db_layer: 'src/db.ts',
      auth_middleware: 'src/middleware/auth.ts',
    },
    briefing_notes: 'Test briefing.',
    ...overrides,
  };
}

describe('buildAttackMatrix', () => {
  it('should create matrix cells from routes and risk signals', () => {
    const preRecon = makePreRecon();
    const matrix = buildAttackMatrix(preRecon);

    expect(matrix.length).toBeGreaterThan(0);
    // users.ts has sql-injection, broken-auth, idor signals
    const sqlCells = matrix.filter(c => c.attack_type === 'sql-injection');
    expect(sqlCells.length).toBe(1);
    expect(sqlCells[0].route.handler_file).toBe('src/routes/users.ts');
  });

  it('should skip routes with no risk signals', () => {
    const preRecon = makePreRecon({
      route_map: [
        {
          endpoint: 'GET /api/health',
          method: 'GET',
          handler_file: 'src/routes/health.ts',
          handler_line: 1,
          middleware: [],
          parameters: [],
        },
      ],
      risk_signals: [], // No signals
    });

    const matrix = buildAttackMatrix(preRecon);
    expect(matrix.length).toBe(0);
  });

  it('should sort by priority (high first)', () => {
    const preRecon = makePreRecon();
    const matrix = buildAttackMatrix(preRecon);

    // All cells with 'sql' in pattern should be high priority
    const priorities = matrix.map(c => c.priority);
    const firstHighIdx = priorities.indexOf('high');
    const lastHighIdx = priorities.lastIndexOf('high');
    const firstMedIdx = priorities.indexOf('medium');

    if (firstHighIdx !== -1 && firstMedIdx !== -1) {
      expect(lastHighIdx).toBeLessThan(firstMedIdx);
    }
  });

  it('should assign high priority when multiple signals match', () => {
    const preRecon = makePreRecon({
      risk_signals: [
        {
          file: 'src/routes/users.ts',
          line: 15,
          pattern: 'xss-unsanitized-output',
          snippet: 'res.send(`<h1>${req.body.name}</h1>`)',
          suggested_attack_types: ['xss'],
        },
        {
          file: 'src/routes/users.ts',
          line: 20,
          pattern: 'xss-reflected',
          snippet: 'res.send(req.query.q)',
          suggested_attack_types: ['xss'],
        },
      ],
    });
    const matrix = buildAttackMatrix(preRecon);
    const xssCells = matrix.filter(c => c.attack_type === 'xss');
    expect(xssCells.length).toBe(1);
    expect(xssCells[0].priority).toBe('high'); // 2 signals = high
  });
});

describe('createTaskAssignments', () => {
  it('should create one assignment per matrix cell', () => {
    const preRecon = makePreRecon();
    const matrix = buildAttackMatrix(preRecon);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));

    try {
      const assignments = createTaskAssignments(preRecon, matrix, tmpDir);
      expect(assignments.length).toBe(matrix.length);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should populate worker_id with attack type', () => {
    const preRecon = makePreRecon();
    const matrix = buildAttackMatrix(preRecon);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));

    try {
      const assignments = createTaskAssignments(preRecon, matrix, tmpDir);
      for (const a of assignments) {
        expect(a.worker_id).toContain(a.attack_type);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should include auth token when provided', () => {
    const preRecon = makePreRecon();
    const matrix = buildAttackMatrix(preRecon);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));

    try {
      const assignments = createTaskAssignments(preRecon, matrix, tmpDir, 'test-token-123');
      for (const a of assignments) {
        expect(a.context.api_keys?.auth_token).toBe('Bearer test-token-123');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should not include api_keys when no auth token is provided', () => {
    const preRecon = makePreRecon();
    const matrix = buildAttackMatrix(preRecon);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));

    try {
      const assignments = createTaskAssignments(preRecon, matrix, tmpDir);
      for (const a of assignments) {
        expect(a.context.api_keys).toBeUndefined();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should read RULES.md when present', () => {
    const preRecon = makePreRecon();
    const matrix = buildAttackMatrix(preRecon);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));

    try {
      fs.writeFileSync(path.join(tmpDir, 'RULES.md'), '- Always use parameterized SQL queries\n- Prioritize critical auth endpoints\n');
      const assignments = createTaskAssignments(preRecon, matrix, tmpDir);

      const sqlAssignment = assignments.find(a => a.attack_type === 'sql-injection');
      if (sqlAssignment) {
        expect(sqlAssignment.context.rules_md.length).toBeGreaterThan(0);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should include briefing text from risk signals', () => {
    const preRecon = makePreRecon();
    const matrix = buildAttackMatrix(preRecon);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));

    try {
      const assignments = createTaskAssignments(preRecon, matrix, tmpDir);
      for (const a of assignments) {
        expect(a.briefing.length).toBeGreaterThan(0);
        expect(a.briefing).toContain('target endpoint');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
