"use client";

export interface CommandSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CommandSearch({
  value,
  onChange,
  placeholder = "Search routes, workers, findings…",
  className = "",
}: CommandSearchProps) {
  return (
    <div className={`relative ${className}`}>
      <kbd className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded border border-dispatch-muted bg-dispatch-slate px-1.5 py-0.5 text-[10px] text-slate-500">
        ⌘K
      </kbd>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-dispatch-muted bg-dispatch-slate py-2 pl-16 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-dispatch-blue/50 focus:outline-none focus:ring-1 focus:ring-dispatch-blue/30"
      />
    </div>
  );
}
