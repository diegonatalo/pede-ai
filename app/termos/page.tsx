import type { Metadata } from "next";
import { TermsPage } from "@/components/terms-page";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras para usar o Pede Aí: o que ele faz, quem responde pelos dados e como excluir a conta.",
  alternates: { canonical: "/termos" },
};

export default function Page() {
  return <TermsPage />;
}
