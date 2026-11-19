import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagerApp } from "@/components/manager/manager-app";
import { RestaurantScope } from "@/components/restaurant-scope";

// Tela da equipe: fora do índice.
export const metadata: Metadata = {
  title: "Gerente",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    // O restaurante vem do endereço, que só existe na requisição: `useParams` pede Suspense.
    <Suspense
      fallback={
        <p className="py-20 text-center text-muted" role="status">
          Carregando…
        </p>
      }
    >
      <RestaurantScope>
        <ManagerApp />
      </RestaurantScope>
    </Suspense>
  );
}
