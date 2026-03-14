"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  FileText,
  ShieldCheck,
  KeyRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    id: "codebase",
    title: "Codebase",
    description: "Repository context and ignore rules",
    Icon: GitBranch,
    content: (
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li className="flex justify-between"><span>Repo</span><span className="text-foreground">github.com/org/my-app</span></li>
        <li className="flex justify-between"><span>Branch</span><span className="text-foreground">main</span></li>
        <li className="flex justify-between"><span>Last commit</span><span className="font-mono text-foreground">a1b2c3d</span></li>
        <li className="flex justify-between"><span>.dispatchignore</span><span className="text-foreground">4 entries</span></li>
      </ul>
    ),
  },
  {
    id: "spec",
    title: "Spec",
    description: "Mission scope and testing focus",
    Icon: FileText,
    content: (
      <p className="text-xs text-muted-foreground">
        Test all auth, injection, secrets, and critical payment routes.
      </p>
    ),
  },
  {
    id: "rules",
    title: "Rules",
    description: "Guardrails to enforce during the run",
    Icon: ShieldCheck,
    content: (
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>Enforce auth on /admin</li>
        <li>No raw SQL in payment handlers</li>
        <li>Secrets in env only</li>
      </ul>
    ),
  },
  {
    id: "secrets",
    title: "Secrets / Access",
    description: "Connected systems and missing integrations",
    Icon: KeyRound,
    content: (
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li className="flex justify-between"><span>API credentials</span><span className="text-primary">connected</span></li>
        <li className="flex justify-between"><span>Datadog</span><span className="text-primary">connected</span></li>
        <li className="flex justify-between"><span>GitHub</span><span className="text-primary">connected</span></li>
        <li className="flex justify-between"><span>Linear</span><span className="text-muted-foreground">not connected</span></li>
      </ul>
    ),
  },
  {
    id: "worker",
    title: "Worker Profile",
    description: "Assigned specializations and concurrency",
    Icon: Users,
    content: (
      <p className="text-xs text-muted-foreground">
        Auth, Injection, Config, Fixer, Retest. Concurrency: 4.
      </p>
    ),
  },
];

export function SetupAccordion() {
  const scrollToSection = (sectionId: string) => {
    document.getElementById(`setup-${sectionId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <Card size="sm" className="bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Setup Overview
        </CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {sections.map(({ id, title, Icon }) => (
            <Button
              key={id}
              variant="outline"
              size="xs"
              onClick={() => scrollToSection(id)}
              className="h-7 rounded-full bg-background/70 px-2.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Icon className="size-3.5" />
              {title}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {sections.map(({ id, title, description, Icon, content }) => (
          <section
            key={id}
            id={`setup-${id}`}
            className="scroll-mt-4 rounded-xl bg-muted/20 p-3"
          >
            <SectionHeader description={description} icon={Icon} title={title} />
            <div className="mt-3">{content}</div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className={cn("text-sm font-medium text-foreground")}>{title}</div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
