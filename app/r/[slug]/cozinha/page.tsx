import type { Metadata } from "next";
import { Suspense } from "react";
import { KitchenApp } from "@/components/kitchen/kitchen-app";
import { RestaurantScope } from "@/components/restaurant-scope";

// Tela da equipe: fora do índice.
export const metadata: Metadata = {
  title: "Cozinha",
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
        <KitchenApp />
      </RestaurantScope>
    </Suspense>
  );
}
