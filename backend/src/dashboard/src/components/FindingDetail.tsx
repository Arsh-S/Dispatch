import type { Finding } from '../types';

function formatEndpointDisplay(loc: { endpoint: string; method?: string }): string {
  if (!loc.method) return loc.endpoint;
  if (loc.endpoint.toUpperCase().startsWith((loc.method || '').toUpperCase() + ' ')) return loc.endpoint;
  return `${loc.method} ${loc.endpoint}`;
}

interface Props {
  finding: Finding;
}

export function FindingDetail({ finding }: Props) {
  const copyCommand = () => {
    if (finding.reproduction?.command) {
      navigator.clipboard.writeText(finding.reproduction.command);
    }
  };

  return (
    <div className="finding-detail">
      <h2>{finding.vuln_type}: {formatEndpointDisplay(finding.location)}</h2>

      <div className="detail-meta">
        <span className={`severity-badge severity-${finding.severity.toLowerCase()}`}>{finding.severity}</span>
        {finding.cvss_score && <span>CVSS: {finding.cvss_score}</span>}
        {finding.owasp && <span>OWASP: {finding.owasp}</span>}
        <span>Exploit: {finding.exploit_confidence}</span>
        <span>Monkeypatch: {finding.monkeypatch?.status || 'n/a'}</span>
      </div>

      <section>
        <h3>Description</h3>
        <p>{finding.description}</p>
        <p><strong>Location:</strong> <code>{finding.location.file}:{finding.location.line}</code></p>
        {finding.location.parameter && <p><strong>Parameter:</strong> <code>{finding.location.parameter}</code></p>}
      </section>

      {finding.reproduction && (
        <section>
          <h3>Reproduction</h3>
          {finding.reproduction.steps && (
            <ol>
              {finding.reproduction.steps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          )}
          <div className="code-block">
            <button className="copy-btn" onClick={copyCommand}>Copy</button>
            <pre><code>{finding.reproduction.command}</code></pre>
          </div>
          <p><strong>Expected:</strong> {finding.reproduction.expected}</p>
          <p><strong>Actual:</strong> {finding.reproduction.actual}</p>
        </section>
      )}

      {finding.server_logs && finding.server_logs.length > 0 && (
        <section>
          <h3>Server Logs</h3>
          <pre className="log-block">
            {finding.server_logs.map((log, i) => (
              <div key={i} className={`log-${log.level.toLowerCase()}`}>
                [{log.timestamp}] {log.level} {log.message}
              </div>
            ))}
          </pre>
        </section>
      )}

      {finding.monkeypatch?.diff && (
        <section>
          <h3>Monkeypatch Diff</h3>
          <pre className="diff-block"><code>{finding.monkeypatch.diff}</code></pre>
          {finding.monkeypatch.validation && (
            <div className="validation">
              <p><strong>Test:</strong> {finding.monkeypatch.validation.test}</p>
              <p><strong>Result:</strong> {finding.monkeypatch.validation.result}</p>
              {finding.monkeypatch.validation.response && <p><strong>Response:</strong> {finding.monkeypatch.validation.response}</p>}
            </div>
          )}
        </section>
      )}

      <section>
        <h3>Recommended Fix</h3>
        <p>{finding.recommended_fix}</p>
      </section>

      {finding.rules_violated.length > 0 && (
        <section>
          <h3>Rules Violated</h3>
          <ul>{finding.rules_violated.map((r, i) => <li key={i}><code>{r}</code></li>)}</ul>
        </section>
      )}

      {finding.github_issue && (
        <section>
          <h3>GitHub Issue</h3>
          <a href={finding.github_issue.url} target="_blank" rel="noopener">
            #{finding.github_issue.number}
          </a>
        </section>
      )}
    </div>
  );
}
