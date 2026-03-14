"use client";

import type { RelatedAsset } from "@/lib/dispatch/graphTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Route,
  FileCode,
  Bug,
  Ticket,
  GitPullRequest,
  RefreshCcw,
} from "lucide-react";

export interface RelatedAssetsPanelProps {
  assets: RelatedAsset[];
}

const typeIcon: Record<string, React.ElementType> = {
  route: Route,
  file: FileCode,
  finding: Bug,
  ticket: Ticket,
  pr: GitPullRequest,
  retest: RefreshCcw,
};

export function RelatedAssetsPanel({ assets }: RelatedAssetsPanelProps) {
  if (assets.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Related
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {assets.map((a) => {
            const Icon = typeIcon[a.type] ?? FileCode;
            const inner = (
              <>
                <Icon className="size-3 text-muted-foreground" />
                <span>{a.label}</span>
              </>
            );
            return a.href ? (
              <a
                key={a.id}
                href={a.href}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
              >
                {inner}
              </a>
            ) : (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground/80"
              >
                {inner}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
