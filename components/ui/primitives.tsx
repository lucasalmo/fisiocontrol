import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/text";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white dark:text-black hover:bg-accent-hover border border-transparent shadow-sm",
  secondary: "bg-surface text-fg border border-border hover:bg-surface-hover shadow-xs",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-hover border border-transparent",
  danger: "bg-danger-strong text-white hover:opacity-90 border border-transparent",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  icon: "h-8 w-8 justify-center",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex items-center rounded-lg font-medium transition-colors duration-150 select-none",
    "disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
    buttonVariants[variant],
    buttonSizes[size],
    extra,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

const fieldBase =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-3 " +
  "transition-colors hover:border-border-strong focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 " +
  "disabled:opacity-60 aria-[invalid=true]:border-danger-strong";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-9", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-9 pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "py-2 leading-relaxed", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger-strong">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-xl border border-border bg-surface shadow-xs", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3 px-4 pt-4 sm:px-5", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-fg-3">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-fg-3">{description}</p> : null}
        </div>
      </div>
      {action}
    </header>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent" | "info";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-2 border-border",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger-strong border-transparent",
  accent: "bg-accent-soft text-accent-text border-transparent",
  info: "bg-info-soft text-info border-transparent",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function ProgressBar({
  value,
  label,
  className,
  tone = "accent",
}: {
  value: number;
  label: string;
  className?: string;
  tone?: "accent" | "success";
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tone === "success" ? "bg-success" : "bg-accent")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-surface-2", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-1 rounded-xl border border-border bg-surface-2 p-2.5 text-fg-3">{icon}</div> : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-fg-3">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-info/30 bg-info-soft text-info",
    warning: "border-warning/30 bg-warning-soft text-warning",
    danger: "border-danger-strong/30 bg-danger-soft text-danger-strong",
    success: "border-success/30 bg-success-soft text-success",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border px-3.5 py-3 text-sm", tones[tone], className)}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1", "text-[13px] opacity-90")}>{children}</div> : null}
    </div>
  );
}
