"use client";

import type { OrchestratorSpec } from "@/lib/dispatch/state";

export interface OrchestratorSpecCardProps {
  spec: OrchestratorSpec | null;
}

export function OrchestratorSpecCard({ spec }: OrchestratorSpecCardProps) {
  if (!spec) return null;
  return (
    <div className="rounded-lg border border-dispatch-muted bg-dispatch-slate/50 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">Orchestrator spec</h3>
      <dl className="space-y-2 text-xs">
        <div>
          <dt className="text-slate-500">Target repo</dt>
          <dd className="text-slate-200">
            {spec.repoUrl ? (
              <a
                href={spec.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dispatch-blue hover:underline"
              >
                {spec.repoName}
              </a>
            ) : (
              spec.repoName
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Environment</dt>
          <dd className="text-slate-200">{spec.targetEnvironment}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Scan mode</dt>
          <dd className="text-slate-200">
            <span className="rounded bg-dispatch-muted/80 px-1.5 py-0.5 font-medium">
              {spec.scanMode}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Frameworks</dt>
          <dd className="flex flex-wrap gap-1">
            {spec.frameworks.map((f) => (
              <span
                key={f}
                className="rounded bg-dispatch-muted/80 px-1.5 py-0.5 text-slate-300"
              >
                {f}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Integrations</dt>
          <dd className="flex flex-wrap gap-1">
            {spec.integrations.map((i) => (
              <span
                key={i}
                className="rounded bg-dispatch-muted/80 px-1.5 py-0.5 text-slate-300"
              >
                {i}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Worker types</dt>
          <dd className="flex flex-wrap gap-1">
            {spec.workerTypes.map((w) => (
              <span
                key={w}
                className="rounded bg-dispatch-blue/20 px-1.5 py-0.5 text-dispatch-blue"
              >
                {w}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Priorities (RULES.md)</dt>
          <dd className="flex flex-wrap gap-1">
            {spec.priorities.map((p) => (
              <span
                key={p}
                className="rounded bg-dispatch-muted/80 px-1.5 py-0.5 text-slate-300"
              >
                {p}
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </div>
  );
}
