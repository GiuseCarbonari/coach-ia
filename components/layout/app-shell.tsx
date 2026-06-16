import { AppHeader } from "@/components/layout/app-header";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-base font-body">
      <AppHeader />
      <main className={cn("app-container page-stack", className)}>
        {children}
      </main>
    </div>
  );
}
