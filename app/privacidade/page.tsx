import type { Metadata } from "next";
import { PrivacyPage } from "@/components/privacy-page";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "O que o Pede Aí guarda, para quê, por quanto tempo e como apagar.",
  alternates: { canonical: "/privacidade" },
};

export default function Page() {
  return <PrivacyPage />;
}
