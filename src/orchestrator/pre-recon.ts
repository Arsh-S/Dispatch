import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { PreReconDeliverable, RouteMapEntry, RiskSignal } from '../schemas/pre-recon-deliverable';

interface PreReconOptions {
  targetDir: string;
  dispatchRunId: string;
}

export async function runPreRecon(options: PreReconOptions): Promise<PreReconDeliverable> {
  const { targetDir, dispatchRunId } = options;

  // Read .dispatchignore
  const ignorePatterns = readDispatchIgnore(targetDir);

  // Find all source files
  const sourceFiles = await findSourceFiles(targetDir, ignorePatterns);

  // Read all file contents
  const fileContents = new Map<string, string>();
  for (const file of sourceFiles) {
    const content = fs.readFileSync(path.join(targetDir, file), 'utf-8');
    fileContents.set(file, content);
  }

  // Analyze routes
  const routeMap = analyzeRoutes(fileContents);

  // Analyze risk signals
  const riskSignals = analyzeRiskSignals(fileContents);

  // Build dependency graph
  const dependencyGraph = analyzeDependencies(fileContents);

  // Read RULES.md
  const rulesPath = path.join(targetDir, 'RULES.md');
  const rules = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf-8') : '';

  return {
    dispatch_run_id: dispatchRunId,
    completed_at: new Date().toISOString(),
    route_map: routeMap,
    risk_signals: riskSignals,
    dependency_graph: dependencyGraph,
    briefing_notes: generateBriefing(routeMap, riskSignals, dependencyGraph, rules),
  };
}

function readDispatchIgnore(targetDir: string): string[] {
  const ignorePath = path.join(targetDir, '.dispatchignore');
  if (!fs.existsSync(ignorePath)) return ['node_modules', '.git'];
  return fs.readFileSync(ignorePath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

async function findSourceFiles(targetDir: string, ignorePatterns: string[]): Promise<string[]> {
  const files = await glob('**/*.{ts,js,tsx,jsx}', {
    cwd: targetDir,
    ignore: ignorePatterns.map(p => `**/${p}/**`).concat(ignorePatterns),
  });
  return files;
}

function analyzeRoutes(fileContents: Map<string, string>): RouteMapEntry[] {
  const routes: RouteMapEntry[] = [];

  // Match Express route patterns: router.get/post/put/delete/patch('path', ...)
  // Also match app.get/post/put/delete/patch('path', ...)
  const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  for (const [filePath, content] of fileContents) {
    if (!filePath.includes('route') && !filePath.includes('app')) continue;

    const lines = content.split('\n');

    routeRegex.lastIndex = 0;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      // Detect middleware in the route definition
      const routeLine = lines[lineNumber - 1] || '';
      const middlewares: string[] = [];
      const mwMatch = routeLine.match(/,\s*([a-zA-Z_]+)\s*,/g);
      if (mwMatch) {
        mwMatch.forEach(m => {
          const name = m.replace(/[,\s]/g, '');
          if (name !== 'req' && name !== 'res' && name !== 'next' && !name.includes('=>') && !name.includes('(')) {
            middlewares.push(name);
          }
        });
      }

      // Detect parameters from route path and body parsing
      const parameters: { name: string; source: 'body' | 'query' | 'params' | 'header'; type: string }[] = [];

      // URL params like :id
      const paramMatches = routePath.match(/:(\w+)/g);
      if (paramMatches) {
        paramMatches.forEach(p => {
          parameters.push({ name: p.slice(1), source: 'params', type: 'string' });
        });
      }

      // Body params (look for req.body.X patterns in surrounding code)
      const bodyRegex = /req\.body\.(\w+)/g;
      let bodyMatch;
      // Search in a window around the route definition
      const startLine = Math.max(0, lineNumber - 1);
      const endLine = Math.min(lines.length, lineNumber + 30);
      const routeBlock = lines.slice(startLine, endLine).join('\n');
      while ((bodyMatch = bodyRegex.exec(routeBlock)) !== null) {
        const paramName = bodyMatch[1];
        if (!parameters.find(p => p.name === paramName)) {
          parameters.push({ name: paramName, source: 'body', type: 'string' });
        }
      }

      // Build full endpoint path
      let fullPath = routePath;
      if (!fullPath.startsWith('/api')) {
        fullPath = `/api${routePath.startsWith('/') ? '' : '/'}${routePath}`;
      }

      routes.push({
        endpoint: `${method} ${fullPath}`,
        method,
        handler_file: filePath,
        handler_line: lineNumber,
        middleware: middlewares,
        parameters,
      });
    }
  }

  return routes;
}

function analyzeRiskSignals(fileContents: Map<string, string>): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const patterns = [
    {
      // SQL injection via string concatenation/template literals
      regex: /(?:query|exec|run|prepare)\s*\(\s*`[^`]*\$\{[^}]*req\b/g,
      pattern: 'raw-sql-concatenation',
      attacks: ['sql-injection'],
    },
    {
      // SQL injection via string concatenation with +
      regex: /(?:query|exec|run|prepare)\s*\(\s*['"][^'"]*['"]\s*\+\s*(?:req\.|params|body)/g,
      pattern: 'raw-sql-concatenation',
      attacks: ['sql-injection'],
    },
    {
      // Missing auth middleware (route handler without auth)
      regex: /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s+)?\(?(?:req|request)/g,
      pattern: 'missing-auth-middleware',
      attacks: ['broken-auth', 'idor'],
    },
    {
      // XSS: unsanitized output
      regex: /res\.send\s*\(\s*`[^`]*\$\{[^}]*(?:req\.|content|input|body)/g,
      pattern: 'xss-unsanitized-output',
      attacks: ['xss'],
    },
    {
      // Hardcoded secrets
      regex: /(?:secret|password|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      pattern: 'hardcoded-secret',
      attacks: ['secrets-exposure'],
    },
    {
      // eval/exec usage
      regex: /\b(?:eval|exec|execSync|spawn)\s*\(/g,
      pattern: 'dangerous-function',
      attacks: ['command-injection'],
    },
    {
      // Error details leaked to client
      regex: /res\.(?:status\(\d+\)\.)?json\s*\(\s*\{\s*error:\s*(?:err|error)\.message/g,
      pattern: 'error-detail-leak',
      attacks: ['open-debug'],
    },
  ];

  for (const [filePath, content] of fileContents) {
    const lines = content.split('\n');

    for (const p of patterns) {
      p.regex.lastIndex = 0;
      let match;
      while ((match = p.regex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const snippetLine = lines[lineNumber - 1]?.trim() || match[0];

        // For missing-auth, only flag routes that DON'T have an auth middleware
        if (p.pattern === 'missing-auth-middleware') {
          const fullLine = lines[lineNumber - 1] || '';
          if (fullLine.includes('auth') || fullLine.includes('Auth')) {
            continue; // Skip - this route has auth
          }
        }

        signals.push({
          file: filePath,
          line: lineNumber,
          pattern: p.pattern,
          snippet: snippetLine.substring(0, 200),
          suggested_attack_types: p.attacks,
        });
      }
    }
  }

  return signals;
}

function analyzeDependencies(fileContents: Map<string, string>): {
  db_layer?: string;
  orm?: string;
  auth_middleware?: string;
  session_store?: string;
} {
  const graph: Record<string, string> = {};

  for (const [filePath, content] of fileContents) {
    if (content.includes('better-sqlite3') || content.includes('sqlite3') || content.includes('pg') || content.includes('mysql')) {
      graph.db_layer = filePath;
    }
    if (content.includes('knex') || content.includes('sequelize') || content.includes('typeorm') || content.includes('prisma')) {
      graph.orm = `detected in ${filePath}`;
    }
    if (filePath.includes('auth') && (content.includes('middleware') || content.includes('verify') || content.includes('jwt'))) {
      graph.auth_middleware = filePath;
    }
    if (content.includes('session') && content.includes('store')) {
      graph.session_store = `detected in ${filePath}`;
    }
  }

  return graph;
}

function generateBriefing(
  routes: RouteMapEntry[],
  signals: RiskSignal[],
  deps: Record<string, string | undefined>,
  rules: string
): string {
  const routeCount = routes.length;
  const signalCount = signals.length;
  const signalTypes = [...new Set(signals.map(s => s.pattern))];

  return `Codebase analysis complete. Found ${routeCount} routes and ${signalCount} risk signals. ` +
    `Risk patterns detected: ${signalTypes.join(', ')}. ` +
    `Database layer: ${deps.db_layer || 'unknown'}. ` +
    `Auth middleware: ${deps.auth_middleware || 'not found'}. ` +
    (rules ? `RULES.md present with ${rules.split('\n').filter(l => l.trim().startsWith('-')).length} rules.` : 'No RULES.md found.');
}
