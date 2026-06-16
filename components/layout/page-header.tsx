import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="font-data mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-amber">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.035em] text-foreground sm:text-[38px]">
          {title}
        </h1>
        {description && (
          <div className="mt-2 text-sm leading-relaxed text-secondary">
            {description}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
