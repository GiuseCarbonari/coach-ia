import { cn } from "@/lib/utils";

export function MetricStrip({
  children,
  className,
  columns = 6,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 3 | 4 | 6;
}) {
  const columnClass = {
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
    6: "sm:grid-cols-3 lg:grid-cols-6",
  }[columns];

  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-3 overflow-hidden rounded-[28px]",
        columnClass,
        "[&>*]:aurora-glass [&>*]:rounded-[20px]",
        className
      )}
    >
      {children}
    </dl>
  );
}
