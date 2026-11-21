import type { Metadata } from "next";
import { SignInForm } from "@/components/account/sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre ou crie a conta do seu restaurante no Pede Aí.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <SignInForm />;
}
