import { PreReconDeliverable, RouteMapEntry, RiskSignal } from '../schemas/pre-recon-deliverable';
import { TaskAssignment } from '../schemas/task-assignment';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface AttackMatrixCell {
  route: RouteMapEntry;
  attack_type: string;
  risk_signals: RiskSignal[];
  priority: 'high' | 'medium' | 'low';
}

export function buildAttackMatrix(preRecon: PreReconDeliverable): AttackMatrixCell[] {
  const matrix: AttackMatrixCell[] = [];

  for (const route of preRecon.route_map) {
    // Find risk signals that match this route's file
    const routeSignals = preRecon.risk_signals.filter(s =>
      s.file === route.handler_file
    );

    if (routeSignals.length === 0) continue; // Skip routes with no risk signals

    // Group by attack type
    const attackTypes = new Set<string>();
    for (const signal of routeSignals) {
      for (const attack of signal.suggested_attack_types) {
        attackTypes.add(attack);
      }
    }

    for (const attackType of attackTypes) {
      const relevantSignals = routeSignals.filter(s =>
        s.suggested_attack_types.includes(attackType)
      );

      matrix.push({
        route,
        attack_type: attackType,
        risk_signals: relevantSignals,
        priority: relevantSignals.length >= 2 ? 'high' : relevantSignals.some(s =>
          s.pattern.includes('sql') || s.pattern.includes('auth') || s.pattern.includes('injection')
        ) ? 'high' : 'medium',
      });
    }
  }

  // Sort by priority
  return matrix.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

export function createTaskAssignments(
  preRecon: PreReconDeliverable,
  matrix: AttackMatrixCell[],
  targetDir: string,
  authToken?: string,
): TaskAssignment[] {
  // Read RULES.md
  const rulesPath = path.join(targetDir, 'RULES.md');
  const rules = fs.existsSync(rulesPath)
    ? fs.readFileSync(rulesPath, 'utf-8').split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim().slice(2))
    : [];

  // Read dispatch.config.yaml
  let appConfig = {
    runtime: 'node',
    install: 'pnpm install',
    start: 'pnpm dev',
    port: 3000,
    seed: 'pnpm db:seed',
    env: {} as Record<string, string>,
  };

  try {
    const configPath = path.join(targetDir, 'dispatch.config.yaml');
    if (fs.existsSync(configPath)) {
      const yaml = require('yaml');
      const config = yaml.parse(fs.readFileSync(configPath, 'utf-8'));
      appConfig = { ...appConfig, ...config, env: config.env || {} };
    }
  } catch {
    // Config parsing failed, use defaults
  }

  return matrix.map(cell => {
    const workerId = `worker-${cell.attack_type}-${cell.route.endpoint.split('/').pop()}-${uuidv4().slice(0, 3)}`;

    // Find relevant context files
    const relevantFiles = new Set<string>();
    if (preRecon.dependency_graph.db_layer) relevantFiles.add(preRecon.dependency_graph.db_layer);
    if (preRecon.dependency_graph.auth_middleware) relevantFiles.add(preRecon.dependency_graph.auth_middleware);
    for (const signal of cell.risk_signals) {
      relevantFiles.add(signal.file);
    }
    relevantFiles.delete(cell.route.handler_file); // Don't include the target file as context

    // Filter rules to those relevant to this attack
    const relevantRules = rules.filter(r => {
      const rLower = r.toLowerCase();
      if (cell.attack_type === 'sql-injection' && (rLower.includes('sql') || rLower.includes('parameterized'))) return true;
      if (cell.attack_type === 'broken-auth' && (rLower.includes('auth') || rLower.includes('endpoint'))) return true;
      if (cell.attack_type === 'xss' && rLower.includes('sanitiz')) return true;
      if (rLower.includes('critical') || rLower.includes('priority')) return true;
      return false;
    });

    // Build briefing from risk signals
    const briefing = cell.risk_signals.map(s =>
      `${s.pattern} detected at ${s.file}:${s.line} — "${s.snippet}"`
    ).join('. ') + `. The target endpoint is ${cell.route.endpoint} handled in ${cell.route.handler_file}:${cell.route.handler_line}.`;

    // Parse method and endpoint from the route endpoint string (e.g., "GET /api/users")
    const endpointParts = cell.route.endpoint.split(' ');
    const endpointPath = endpointParts.length > 1 ? endpointParts.slice(1).join(' ') : cell.route.endpoint;

    const assignment: TaskAssignment = {
      dispatch_run_id: preRecon.dispatch_run_id,
      worker_id: workerId,
      assigned_at: new Date().toISOString(),
      timeout_seconds: 300,
      target: {
        file: cell.route.handler_file,
        endpoint: endpointPath,
        method: cell.route.method,
        parameters: cell.route.parameters.map(p => p.name),
      },
      attack_type: cell.attack_type,
      context: {
        relevant_files: [...relevantFiles],
        api_keys: authToken ? { auth_token: `Bearer ${authToken}` } : undefined,
        rules_md: relevantRules,
      },
      app_config: appConfig,
      briefing,
    };

    return assignment;
  });
}
