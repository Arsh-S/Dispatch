import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { z } from 'zod';
import { PreReconDeliverable, RouteMapEntry, RiskSignal, RouteMapEntrySchema, RiskSignalSchema } from '../schemas/pre-recon-deliverable';
import { runClaudeAgent } from '../agent-adapters/claude-agent-runner';

interface PreReconOptions {
  targetDir: string;
  dispatchRunId: string;
  /**
   * When 'hybrid', runs the static analysis first then invokes a Claude agent
   * to augment the results (add additional routes, risk signals, or refine
   * the briefing_notes). Default is 'static'.
   */
  mode?: 'static' | 'hybrid';
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

  const staticResult: PreReconDeliverable = {
    dispatch_run_id: dispatchRunId,
    completed_at: new Date().toISOString(),
    route_map: routeMap,
    risk_signals: riskSignals,
    dependency_graph: dependencyGraph,
    briefing_notes: generateBriefing(routeMap, riskSignals, dependencyGraph, rules),
  };

  if (options.mode !== 'hybrid') {
    return staticResult;
  }

  // Hybrid mode: augment the static results with a Claude analysis pass
  return augmentWithClaude(staticResult, targetDir, sourceFiles);
}

// ---------------------------------------------------------------------------
// Claude Augmentation Pass (hybrid mode only)
// ---------------------------------------------------------------------------

/**
 * Schema for the Claude augmentation output.
 * All fields use .default() so the result is always fully typed.
 */
const ClaudeAugmentationSchema = z.object({
  additional_routes: z.array(RouteMapEntrySchema).default([]),
  additional_risk_signals: z.array(RiskSignalSchema).default([]),
  briefing_notes: z.string().default(''),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
});

const PRERECON_SYSTEM_PROMPT = `You are an expert application security researcher performing reconnaissance on a web application codebase.

Your task is to augment an existing static analysis report by applying your deep understanding of security vulnerabilities to identify:
1. Routes that the static regex-based analysis may have missed (e.g. framework-specific patterns, conditional routes)
2. Additional risk signals beyond what pattern matching can detect (e.g. business logic flaws, trust boundary violations)
3. A refined security briefing that prioritizes the most critical attack surfaces

Ground rules:
- Only report findings you can directly see in the source files.
- Do not hallucinate routes or signals not present in the code.
- Focus on high-signal findings that static analysis is likely to miss.
- Your output must be valid JSON conforming to the provided schema.`;

async function augmentWithClaude(
  staticResult: PreReconDeliverable,
  targetDir: string,
  sourceFiles: string[],
): Promise<PreReconDeliverable> {
  console.log('[PreRecon/Hybrid] Starting Claude augmentation pass...');

  // Build context snippet: file list + existing static findings summary
  const fileList = sourceFiles.slice(0, 50).join('\n'); // limit context size
  const existingRoutesJson = JSON.stringify(staticResult.route_map.slice(0, 20), null, 2);
  const existingSignalsJson = JSON.stringify(staticResult.risk_signals.slice(0, 20), null, 2);

  const taskPrompt = `# Pre-Recon Augmentation Task

## Static Analysis Results (already completed)
The following routes and risk signals were found by regex-based static analysis.

### Existing Routes (up to 20 shown)
\`\`\`json
${existingRoutesJson}
\`\`\`

### Existing Risk Signals (up to 20 shown)
\`\`\`json
${existingSignalsJson}
\`\`\`

### Static Briefing
${staticResult.briefing_notes}

## Source Files Available
\`\`\`
${fileList}
\`\`\`

## Your Task
Review the source files listed above (they are in the current working directory: ${targetDir}).
Identify:
1. Routes that the static analysis missed (additional_routes array).
2. Risk signals the static analysis missed (additional_risk_signals array).
3. An enhanced briefing_notes string that adds security context beyond what the static analysis captured.
4. Your confidence level in the augmentation (high/medium/low).

Return structured JSON only.`;

  const agentResult = await runClaudeAgent({
    systemPrompt: PRERECON_SYSTEM_PROMPT,
    taskPrompt,
    outputSchema: ClaudeAugmentationSchema,
    timeoutMs: 120_000,
    cwd: targetDir,
  });

  if (!agentResult.success || !agentResult.data) {
    console.warn(`[PreRecon/Hybrid] Claude augmentation failed: ${agentResult.error}. Returning static results.`);
    return staticResult;
  }

  const augmentation = agentResult.data;
  console.log(
    `[PreRecon/Hybrid] Claude added ${augmentation.additional_routes.length} routes and ` +
    `${augmentation.additional_risk_signals.length} signals (confidence: ${augmentation.confidence})`,
  );

  // Merge augmentation into the static result
  const mergedRoutes: RouteMapEntry[] = [
    ...staticResult.route_map,
    ...augmentation.additional_routes,
  ];

  const mergedSignals: RiskSignal[] = [
    ...staticResult.risk_signals,
    ...augmentation.additional_risk_signals,
  ];

  const mergedBriefing = augmentation.briefing_notes
    ? `${staticResult.briefing_notes}\n\n[Claude Augmentation — confidence: ${augmentation.confidence}]\n${augmentation.briefing_notes}`
    : staticResult.briefing_notes;

  return {
    ...staticResult,
    route_map: mergedRoutes,
    risk_signals: mergedSignals,
    briefing_notes: mergedBriefing,
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
  const files = await glob('**/*.{ts,js,tsx,jsx,py}', {
    cwd: targetDir,
    ignore: ignorePatterns.map(p => `**/${p}/**`).concat(ignorePatterns),
  });
  return files;
}

function analyzeRoutes(fileContents: Map<string, string>): RouteMapEntry[] {
  const routes: RouteMapEntry[] = [];

  // Match Express route patterns: router.get/post/put/delete/patch('path', ...)
  // Also match app.get/post/put/delete/patch('path', ...)
  // Also match named routers like commentsRouter.post(...)
  const routeRegex = /(?:\w*(?:router|Router|app))\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  // Match Flask route decorators: @app.route('/path', methods=['GET', 'POST'])
  const flaskRouteRegex = /@(?:app|blueprint|\w+)\.route\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*methods\s*=\s*\[([^\]]*)\])?\s*\)/g;

  for (const [filePath, content] of fileContents) {
    // Flask (.py) route detection
    if (filePath.endsWith('.py')) {
      const lines = content.split('\n');
      flaskRouteRegex.lastIndex = 0;
      let match;
      while ((match = flaskRouteRegex.exec(content)) !== null) {
        const routePath = match[1];
        const methodsRaw = match[2] || "'GET'";
        const methods = methodsRaw.match(/['"](\w+)['"]/g)?.map(m => m.replace(/['"]/g, '').toUpperCase()) || ['GET'];
        const lineNumber = content.substring(0, match.index).split('\n').length;

        // Find parameters: <type:name> in path, request.form.get / request.args.get / request.json
        const parameters: { name: string; source: 'body' | 'query' | 'params' | 'header'; type: string }[] = [];
        const pathParamMatches = routePath.match(/<(?:\w+:)?(\w+)>/g);
        if (pathParamMatches) {
          pathParamMatches.forEach(p => {
            const name = p.replace(/<(?:\w+:)?(\w+)>/, '$1');
            parameters.push({ name, source: 'params', type: 'string' });
          });
        }

        const startLine = Math.max(0, lineNumber);
        const endLine = Math.min(lines.length, lineNumber + 30);
        const fnBlock = lines.slice(startLine, endLine).join('\n');

        const formRegex = /request\.form\.get\s*\(\s*['"](\w+)['"]/g;
        let fm;
        while ((fm = formRegex.exec(fnBlock)) !== null) {
          if (!parameters.find(p => p.name === fm[1])) parameters.push({ name: fm[1], source: 'body', type: 'string' });
        }
        const argsRegex = /request\.args\.get\s*\(\s*['"](\w+)['"]/g;
        let am;
        while ((am = argsRegex.exec(fnBlock)) !== null) {
          if (!parameters.find(p => p.name === am[1])) parameters.push({ name: am[1], source: 'query', type: 'string' });
        }

        for (const method of methods) {
          routes.push({
            endpoint: `${method} ${routePath}`,
            method,
            handler_file: filePath,
            handler_line: lineNumber,
            middleware: [],
            parameters,
          });
        }
      }
      continue;
    }

    if (!filePath.includes('route') && !filePath.includes('app') && !filePath.includes('Router')) continue;

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

      // Also detect destructured body params: const { x, y } = req.body
      const destructureRegex = /(?:const|let|var)\s*\{\s*([^}]+)\}\s*=\s*req\.body/g;
      let destructureMatch;
      while ((destructureMatch = destructureRegex.exec(routeBlock)) !== null) {
        const names = destructureMatch[1].split(',').map(s => s.trim().split(':')[0].split('=')[0].trim());
        for (const name of names) {
          if (name && !parameters.find(p => p.name === name)) {
            parameters.push({ name, source: 'body', type: 'string' });
          }
        }
      }

      // Query params (req.query.X or destructured)
      const queryRegex = /req\.query\.(\w+)/g;
      let queryMatch;
      while ((queryMatch = queryRegex.exec(routeBlock)) !== null) {
        const paramName = queryMatch[1];
        if (!parameters.find(p => p.name === paramName)) {
          parameters.push({ name: paramName, source: 'query', type: 'string' });
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
      // Python SQL injection via f-string or % formatting
      regex: /cursor\.execute\s*\(\s*(?:f['"]|['"][^'"]*%\s*(?:username|password|input|query|param))/g,
      pattern: 'raw-sql-concatenation',
      attacks: ['sql-injection'],
    },
    {
      // Python OS command injection via os.system / subprocess with user input
      regex: /(?:os\.system|subprocess\.(?:call|run|Popen))\s*\(\s*(?:f['"]|[^)]*\+\s*(?:host|ip|cmd|input|param))/g,
      pattern: 'command-injection',
      attacks: ['command-injection'],
    },
    {
      // Python insecure deserialization
      regex: /pickle\.loads\s*\(/g,
      pattern: 'insecure-deserialization',
      attacks: ['deserialization'],
    },
    {
      // Python hardcoded secrets/credentials
      regex: /(?:SECRET|PASSWORD|API_KEY|ACCESS_KEY|TOKEN)\s*=\s*['"][^'"]{8,}['"]/g,
      pattern: 'hardcoded-secret',
      attacks: ['secrets-exposure'],
    },
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
