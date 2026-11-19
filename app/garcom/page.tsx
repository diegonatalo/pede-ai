import type { Metadata } from "next";
import { WaiterApp } from "@/components/waiter/waiter-app";

// Tela da equipe: fora do índice.
export const metadata: Metadata = {
  title: "Garçom",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <WaiterApp />;
}
