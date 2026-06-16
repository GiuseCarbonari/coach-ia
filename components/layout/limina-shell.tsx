import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { cn } from "@/lib/utils";

/**
 * Shell mobile-first del design Limina: colonna singola centrata
 * (max 640px) con tab bar fissa in basso. Usata dalle schermate già
 * ridisegnate; le altre restano su AppShell finché non vengono rifatte.
 */
export function LiminaShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-base font-body">
      <main
        className={cn(
          "mx-auto flex w-full max-w-[640px] flex-col gap-5 px-5 pb-28 pt-8 sm:px-6",
          className
        )}
      >
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
