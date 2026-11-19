import { UtensilsIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { SITE_NAME } from "@/lib/site";

/** Marca do Pede Aí: o selo com talheres e o nome na fonte de títulos. */
export const BrandMark = ({ className, onPhoto = false }: { className?: string; onPhoto?: boolean }) => (
  <span className={cn("inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight", className)}>
    <span
      className={cn(
        "grid size-8 place-items-center rounded-xl shadow-soft",
        onPhoto ? "bg-white text-[#c43d16]" : "bg-accent text-on-accent",
      )}
    >
      <UtensilsIcon className="size-[18px]" strokeWidth={2.2} />
    </span>
    {SITE_NAME}
  </span>
);

/** Brilho quente atrás das telas centralizadas (login, entrada na mesa, avisos). */
export const AmbientGlow = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[60vh] bg-[radial-gradient(60%_70%_at_50%_0%,var(--accent-soft),transparent)]"
  />
);
