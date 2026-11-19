import type { Metadata } from "next";
import { AccountApp } from "@/components/account/account-app";

// Área do dono: fora do índice.
export const metadata: Metadata = {
  title: "Sua conta",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AccountApp />;
}
