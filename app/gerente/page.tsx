import type { Metadata } from "next";
import { ManagerApp } from "@/components/manager/manager-app";

// Tela da equipe: fora do índice.
export const metadata: Metadata = {
  title: "Gerente",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ManagerApp />;
}
