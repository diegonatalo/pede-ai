import type { Metadata } from "next";
import { DemoGuide } from "@/components/demo-guide";

export const metadata: Metadata = {
  title: "Demonstração",
  description: "Experimente o Pede Aí num restaurante de exemplo: garçom, cozinha, bar e a mesa do cliente, com PINs públicos.",
  alternates: { canonical: "/demo" },
};

export default function Page() {
  return <DemoGuide />;
}
