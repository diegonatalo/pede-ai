import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerApp } from "@/components/customer/customer-app";

// Cada mesa é privada de quem está nela: fora do índice.
export const metadata: Metadata = {
  title: "Mesa",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    // O id da mesa só existe na requisição: com cacheComponents, `useParams` pede Suspense.
    <Suspense
      fallback={
        <p className="py-20 text-center text-muted" role="status">
          Carregando…
        </p>
      }
    >
      <CustomerApp />
    </Suspense>
  );
}
