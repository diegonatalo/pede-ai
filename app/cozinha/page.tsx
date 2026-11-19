import type { Metadata } from "next";
import { KitchenApp } from "@/components/kitchen/kitchen-app";

// Tela da equipe: fora do índice.
export const metadata: Metadata = {
  title: "Cozinha e bar",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <KitchenApp />;
}
