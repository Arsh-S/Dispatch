"use client";

import { useState } from "react";

const sections = [
  {
    id: "codebase",
    title: "Codebase",
    content: (
      <ul className="space-y-1 text-xs text-slate-400">
        <li>Repo: github.com/org/my-app</li>
        <li>Branch: main</li>
        <li>Last commit: a1b2c3d</li>
        <li>.dispatchignore: 4 entries</li>
      </ul>
    ),
  },
  {
    id: "spec",
    title: "Spec",
    content: (
      <p className="text-xs text-slate-400">
        Test all auth, injection, secrets, and critical payment routes.
      </p>
    ),
  },
  {
    id: "rules",
    title: "Rules",
    content: (
      <ul className="space-y-1 text-xs text-slate-400">
        <li>Enforce auth on /admin</li>
        <li>No raw SQL in payment handlers</li>
        <li>Secrets in env only</li>
      </ul>
    ),
  },
  {
    id: "secrets",
    title: "Secrets / access",
    content: (
      <ul className="space-y-1 text-xs text-slate-400">
        <li>API credentials: connected</li>
        <li>Datadog: connected</li>
        <li>GitHub: connected</li>
        <li>Linear: not connected</li>
      </ul>
    ),
  },
  {
    id: "worker",
    title: "Worker profile",
    content: (
      <p className="text-xs text-slate-400">
        Auth, Injection, Config, Fixer, Retest. Concurrency: 4.
      </p>
    ),
  },
];

export function SetupAccordion() {
  const [openId, setOpenId] = useState<string | null>("codebase");
  return (
    <div className="border border-dispatch-muted rounded-lg overflow-hidden">
      {sections.map(({ id, title, content }) => (
        <div key={id} className="border-b border-dispatch-muted last:border-b-0">
          <button
            type="button"
            onClick={() => setOpenId(openId === id ? null : id)}
            className="flex w-full items-center justify-between bg-dispatch-slate/50 px-3 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-dispatch-slate"
          >
            {title}
            <span className="text-slate-500">
              {openId === id ? "−" : "+"}
            </span>
          </button>
          {openId === id && (
            <div className="border-t border-dispatch-muted bg-dispatch-charcoal/50 px-3 py-2">
              {content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
