"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  GitBranch,
  FileText,
  ShieldCheck,
  KeyRound,
  Users,
} from "lucide-react";

const sections = [
  {
    id: "codebase",
    title: "Codebase",
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
    Icon: Users,
    content: (
      <p className="text-xs text-muted-foreground">
        Auth, Injection, Config, Fixer, Retest. Concurrency: 4.
      </p>
    ),
  },
];

export function SetupAccordion() {
  return (
    <Accordion className="rounded-lg bg-card">
      {sections.map(({ id, title, Icon, content }) => (
        <AccordionItem key={id} className="last:border-b-0 px-3" value={id}>
          <AccordionTrigger className="gap-2 text-sm hover:no-underline">
            <Icon className="size-4 text-muted-foreground" />
            {title}
          </AccordionTrigger>
          <AccordionContent>{content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
