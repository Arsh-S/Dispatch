import { useState, useEffect } from 'react';
import type { ScanResult } from './types';
import { ScanSummary } from './components/ScanSummary';
import { FindingsList } from './components/FindingsList';
import { FindingDetail } from './components/FindingDetail';
import './App.css';

function App() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/dispatch-output.json');
        if (res.ok) {
          const data = await res.json();
          setScanResult(data);
          setError(null);
        }
      } catch {
        // File may not exist yet
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const selectedFinding = scanResult?.findings.find(f => f.finding_id === selectedFindingId);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dispatch Security Scanner</h1>
        {scanResult && <span className="run-id">{scanResult.dispatch_run_id}</span>}
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!scanResult ? (
        <div className="loading">
          <p>Waiting for scan results...</p>
          <p className="loading-sub">Polling dispatch-output.json every 2 seconds</p>
        </div>
      ) : (
        <div className="content">
          <ScanSummary result={scanResult} />
          <div className="main-panel">
            <FindingsList
              findings={scanResult.findings}
              selectedId={selectedFindingId}
              onSelect={setSelectedFindingId}
            />
            {selectedFinding && (
              <FindingDetail finding={selectedFinding} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
