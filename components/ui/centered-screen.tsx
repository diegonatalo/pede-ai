import { AmbientGlow, BrandMark } from "@/components/ui/brand";
import { cn } from "@/lib/cn";

/** Tela com um cartão no meio (login, código da mesa, avisos), com a marca em cima. */
export const CenteredScreen = ({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) => (
  <main
    id="conteudo"
    className={cn("relative isolate mx-auto flex w-full flex-1 flex-col justify-center gap-6 px-4 py-10", wide ? "max-w-md" : "max-w-sm")}
  >
    <AmbientGlow />
    <BrandMark className="self-center" />
    {children}
  </main>
);
