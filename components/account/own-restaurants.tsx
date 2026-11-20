"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CreateRestaurantForm } from "@/components/account/create-restaurant-form";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import { useOwnRestaurants } from "@/hooks/use-own-restaurants";
import { cn } from "@/lib/cn";
import { apiRequest } from "@/lib/api-client";
import { MAX_RESTAURANTS_PER_OWNER } from "@/lib/restaurant-template";
import type { RestaurantRecord } from "@/types/store";

/** Restaurantes da conta: entrar como gerente, abrir as telas e cadastrar um novo. */
export const OwnRestaurants = () => {
  const router = useRouter();
  const { state, refresh } = useOwnRestaurants();
  const [created, setCreated] = useState<{ restaurant: RestaurantRecord; pin: string } | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const enter = async (restaurant: RestaurantRecord) => {
    setEntering(restaurant.slug);
    setMessage("");
    const response = await apiRequest("/api/account/restaurants/enter", {
      method: "POST",
      body: { slug: restaurant.slug },
    });
    if (!response.ok) {
      setEntering(null);
      setMessage(response.message);
      return;
    }
    router.push(`/r/${restaurant.slug}/gerente`);
  };

  if (state.status === "loading") {
    return (
      <p className="text-muted" role="status">
        Carregando os restaurantes…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted">{state.message}</p>
        <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => void refresh()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {created && (
        <section
          className="flex flex-col gap-2 rounded-2xl border-2 border-accent bg-card p-5"
          role="status"
          aria-label={`PIN de gerente de ${created.restaurant.name}`}
        >
          <p className="font-semibold">{created.restaurant.name} está pronto. Seu PIN de gerente:</p>
          <p className="font-mono text-4xl font-bold tracking-[0.3em]">{created.pin}</p>
          <p className="text-sm text-muted">
            Anote: ele não aparece de novo. Use o PIN para entrar pelos aparelhos do restaurante; daqui da conta você
            entra sem ele.
          </p>
          <button type="button" className={`${BUTTON.secondary} self-start`} onClick={() => setCreated(null)}>
            Já anotei
          </button>
        </section>
      )}

      {message && (
        <p className="rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      )}

      {state.restaurants.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Seus restaurantes">
          {state.restaurants.map((restaurant) => (
            <li key={restaurant.id} className={cn(CARD, "flex flex-col gap-3 p-4")}>
              <div>
                <p className="font-semibold">{restaurant.name}</p>
                <p className="font-mono text-sm text-muted">/r/{restaurant.slug}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BUTTON.primary}
                  disabled={entering === restaurant.slug}
                  onClick={() => void enter(restaurant)}
                  aria-label={`Abrir a tela do gerente de ${restaurant.name}`}
                >
                  Tela do gerente
                </button>
                <Link
                  href={`/r/${restaurant.slug}/garcom`}
                  className={BUTTON.secondary}
                  aria-label={`Tela do garçom de ${restaurant.name}`}
                >
                  Garçom
                </Link>
                <Link
                  href={`/r/${restaurant.slug}/cozinha`}
                  className={BUTTON.secondary}
                  aria-label={`Cozinha e bar de ${restaurant.name}`}
                >
                  Cozinha
                </Link>
              </div>
              <DeleteRestaurant restaurant={restaurant} onDeleted={() => void refresh()} />
            </li>
          ))}
        </ul>
      )}

      {state.restaurants.length < MAX_RESTAURANTS_PER_OWNER ? (
        <section aria-labelledby="titulo-novo-restaurante" className="flex flex-col gap-3">
          <h2 id="titulo-novo-restaurante" className="text-lg font-bold">
            {state.restaurants.length === 0 ? "Cadastre o seu restaurante" : "Cadastrar outro restaurante"}
          </h2>
          <p className="text-sm text-muted">
            Ele começa com um salão e um cardápio de exemplo, para você testar tudo. Depois, troque pelo seu na tela do
            gerente, em Cardápio e em Ajustes.
          </p>
          <CreateRestaurantForm
            onCreated={(restaurant, pin) => {
              setCreated({ restaurant, pin });
              void refresh();
            }}
          />
        </section>
      ) : (
        <p className="text-sm text-muted">Cada conta pode ter até {MAX_RESTAURANTS_PER_OWNER} restaurantes por enquanto.</p>
      )}
    </div>
  );
};

/** Excluir um restaurante: escondido atrás de um "Excluir", e pede o endereço digitado de novo. */
const DeleteRestaurant = ({ restaurant, onDeleted }: { restaurant: RestaurantRecord; onDeleted: () => void }) => {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className={`${BUTTON.smallGhost} self-start text-danger`}
        onClick={() => setOpen(true)}
        aria-label={`Excluir ${restaurant.name}`}
      >
        Excluir restaurante
      </button>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const response = await apiRequest("/api/account/restaurants/delete", {
      method: "POST",
      body: { slug: restaurant.slug, confirm: confirm.trim() },
    });
    setSending(false);
    if (response.ok) onDeleted();
    else setMessage(response.message);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl bg-danger-soft p-4"
      aria-label={`Excluir ${restaurant.name} para sempre`}
    >
      <p className="text-sm font-medium text-danger">
        Isso apaga o restaurante e tudo dele: cardápio, mesas, equipe, pedidos e números. Não tem como desfazer.
      </p>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>
          Para confirmar, digite <span className="font-mono">{restaurant.slug}</span>
        </span>
        <input className={INPUT} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
      </label>
      {message && (
        <p className="text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BUTTON.danger} disabled={sending || confirm.trim() !== restaurant.slug}>
          {sending ? "Excluindo…" : "Excluir para sempre"}
        </button>
        <button
          type="button"
          className={BUTTON.ghost}
          onClick={() => {
            setOpen(false);
            setConfirm("");
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};
