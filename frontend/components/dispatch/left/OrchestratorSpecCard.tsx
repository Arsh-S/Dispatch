"use client";

import type { OrchestratorSpec } from "@/lib/dispatch/state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

export interface OrchestratorSpecCardProps {
  spec: OrchestratorSpec | null;
}

function TagList({ items, variant = "default" }: { items: string[]; variant?: "default" | "primary" }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className={
            variant === "primary"
              ? "rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary"
              : "rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
          }
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function OrchestratorSpecCard({ spec }: OrchestratorSpecCardProps) {
  if (!spec) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Orchestrator Spec
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2.5 text-xs">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Repo</dt>
            <dd>
              {spec.repoUrl ? (
                <a
                  href={spec.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {spec.repoName}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-foreground">{spec.repoName}</span>
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Environment</dt>
            <dd className="text-foreground">{spec.targetEnvironment}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Scan mode</dt>
            <dd>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                {spec.scanMode}
              </span>
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-muted-foreground">Frameworks</dt>
            <dd><TagList items={spec.frameworks} /></dd>
          </div>
          <div>
            <dt className="mb-1 text-muted-foreground">Integrations</dt>
            <dd><TagList items={spec.integrations} /></dd>
          </div>
          <div>
            <dt className="mb-1 text-muted-foreground">Workers</dt>
            <dd><TagList items={spec.workerTypes} variant="primary" /></dd>
          </div>
          <div>
            <dt className="mb-1 text-muted-foreground">Priorities</dt>
            <dd><TagList items={spec.priorities} /></dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
