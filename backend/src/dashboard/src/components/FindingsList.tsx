import type { Finding } from '../types';

function formatEndpointDisplay(loc: { endpoint: string; method?: string }): string {
  if (!loc.method) return loc.endpoint;
  if (loc.endpoint.toUpperCase().startsWith((loc.method || '').toUpperCase() + ' ')) return loc.endpoint;
  return `${loc.method} ${loc.endpoint}`;
}

interface Props {
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_COLORS = {
  CRITICAL: '#5c0000',
  HIGH: '#b60205',
  MEDIUM: '#e99695',
  LOW: '#fbca04',
};

export function FindingsList({ findings, selectedId, onSelect }: Props) {
  const sorted = [...findings].sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <div className="findings-list">
      <h2>Findings ({findings.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Endpoint</th>
            <th>File</th>
            <th>Exploit</th>
            <th>Monkeypatch</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => (
            <tr
              key={f.finding_id}
              className={selectedId === f.finding_id ? 'selected' : ''}
              onClick={() => onSelect(selectedId === f.finding_id ? null : f.finding_id)}
            >
              <td>
                <span className="severity-badge" style={{ backgroundColor: SEVERITY_COLORS[f.severity] }}>
                  {f.severity}
                </span>
              </td>
              <td>{f.vuln_type}</td>
              <td><code>{formatEndpointDisplay(f.location)}</code></td>
              <td><code>{f.location.file}:{f.location.line}</code></td>
              <td className={`confidence-${f.exploit_confidence}`}>{f.exploit_confidence}</td>
              <td className={`monkeypatch-${f.monkeypatch?.status || 'none'}`}>{f.monkeypatch?.status || 'n/a'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
