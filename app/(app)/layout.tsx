import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { authMode } from "@/lib/auth/token";

async function DevAuthNotice() {
  await connection();
  if (authMode().mode !== "disabled-dev") return null;
  return (
    <div className="border-b border-warning/30 bg-warning-soft px-4 py-1.5 text-center text-xs text-warning">
      Modo de desenvolvimento sem senha: defina APP_PASSWORD e SESSION_SECRET antes de expor a aplicação na internet.
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <DevAuthNotice />
        </Suspense>
        <AppHeader />
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
