"use client";

import { useState, type FormEvent } from "react";
import { MenuItemForm, type MenuItemFields } from "@/components/manager/menu-item-form";
import { BUTTON, CARD, INPUT, LABEL } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { STATION_LABEL } from "@/lib/labels";
import { MENU_LIMITS, type MenuChange } from "@/lib/menu-editor";
import { formatCents } from "@/lib/money";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { Menu } from "@/types/store";

type Props = {
  menu: Menu;
  busy: string | null;
  run: (key: string, path: string, body?: unknown) => Promise<boolean>;
};

const SMALL = "min-h-10 px-3 text-sm";

/** O que está aberto: um formulário ou a confirmação de uma exclusão. */
type Open =
  | { kind: "new_item"; categoryId: string }
  | { kind: "edit_item"; itemId: string }
  | { kind: "rename"; categoryId: string }
  | { kind: "delete"; id: string }
  | null;

/**
 * Cardápio para o gerente: categorias e itens, com criar, editar, ordenar e excluir.
 * Cada botão manda uma mudança só; o cardápio na tela vem sempre do servidor.
 */
export const MenuEditor = ({ menu, busy, run }: Props) => {
  const [open, setOpen] = useState<Open>(null);
  const categories = [...menu.categories].sort((a, b) => a.position - b.position);
  const change = (key: string, body: MenuChange) => run(key, "/api/staff/menu", body);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        As mudanças aparecem na hora para os clientes. Pedidos já feitos guardam o nome e o preço do momento.
      </p>
      {categories.map((category, index) => (
        <CategorySection
          key={category.id}
          category={category}
          categories={categories}
          items={menu.items.filter((item) => item.categoryId === category.id)}
          first={index === 0}
          last={index === categories.length - 1}
          open={open}
          setOpen={setOpen}
          busy={busy}
          change={change}
        />
      ))}
      {categories.length < MENU_LIMITS.categories && <NewCategoryForm busy={busy === "nova-categoria"} change={change} />}
    </div>
  );
};

type SectionProps = {
  category: MenuCategory;
  categories: MenuCategory[];
  items: MenuItem[];
  first: boolean;
  last: boolean;
  open: Open;
  setOpen: (open: Open) => void;
  busy: string | null;
  change: (key: string, body: MenuChange) => Promise<boolean>;
};

const CategorySection = ({ category, categories, items, first, last, open, setOpen, busy, change }: SectionProps) => {
  const headingId = `categoria-${category.id}`;
  const renaming = open?.kind === "rename" && open.categoryId === category.id;
  const deleting = open?.kind === "delete" && open.id === category.id;
  const adding = open?.kind === "new_item" && open.categoryId === category.id;
  const saveItem = (key: string, fields: MenuItemFields, id?: string) =>
    change(key, { type: "save_item", ...(id && { id }), ...fields });

  return (
    <section aria-labelledby={headingId} className={cn(CARD, "flex flex-col gap-4 p-4")}>
      {renaming ? (
        <RenameForm
          category={category}
          busy={busy === category.id}
          onSubmit={async (name) => {
            if (await change(category.id, { type: "save_category", id: category.id, name })) setOpen(null);
          }}
          onCancel={() => setOpen(null)}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="text-xl font-bold">
            {category.name}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(BUTTON.secondary, SMALL)}
              disabled={first || busy === category.id}
              onClick={() => void change(category.id, { type: "move_category", id: category.id, direction: "up" })}
              aria-label={`Subir a categoria ${category.name}`}
            >
              ↑
            </button>
            <button
              type="button"
              className={cn(BUTTON.secondary, SMALL)}
              disabled={last || busy === category.id}
              onClick={() => void change(category.id, { type: "move_category", id: category.id, direction: "down" })}
              aria-label={`Descer a categoria ${category.name}`}
            >
              ↓
            </button>
            <button
              type="button"
              className={cn(BUTTON.ghost, SMALL)}
              onClick={() => setOpen({ kind: "rename", categoryId: category.id })}
              aria-label={`Renomear a categoria ${category.name}`}
            >
              Renomear
            </button>
            {items.length === 0 && (
              <DeleteButton
                label={`a categoria ${category.name}`}
                confirming={deleting}
                busy={busy === category.id}
                onAsk={() => setOpen({ kind: "delete", id: category.id })}
                onCancel={() => setOpen(null)}
                onConfirm={() =>
                  void change(category.id, { type: "delete_category", id: category.id }).then((ok) => ok && setOpen(null))
                }
              />
            )}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nenhum item nesta categoria.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border" aria-label={`Itens de ${category.name}`}>
          {items.map((item, index) =>
            open?.kind === "edit_item" && open.itemId === item.id ? (
              <li key={item.id} className="py-3">
                <MenuItemForm
                  categories={categories}
                  item={item}
                  categoryId={category.id}
                  busy={busy === item.id}
                  onSubmit={(fields) => saveItem(item.id, fields, item.id)}
                  onCancel={() => setOpen(null)}
                />
              </li>
            ) : (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 sm:flex-1">
                  <p className="font-semibold">
                    {item.name}
                    {!item.available && (
                      <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs font-semibold text-muted">
                        esgotado
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {formatCents(item.priceCents)} · {STATION_LABEL[item.station]}
                  </p>
                  {item.description && <p className="text-sm text-muted">{item.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(BUTTON.secondary, SMALL)}
                    disabled={index === 0 || busy === item.id}
                    onClick={() => void change(item.id, { type: "move_item", id: item.id, direction: "up" })}
                    aria-label={`Subir ${item.name}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={cn(BUTTON.secondary, SMALL)}
                    disabled={index === items.length - 1 || busy === item.id}
                    onClick={() => void change(item.id, { type: "move_item", id: item.id, direction: "down" })}
                    aria-label={`Descer ${item.name}`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={cn(BUTTON.ghost, SMALL)}
                    onClick={() => setOpen({ kind: "edit_item", itemId: item.id })}
                    aria-label={`Editar ${item.name}`}
                  >
                    Editar
                  </button>
                  <DeleteButton
                    label={item.name}
                    confirming={open?.kind === "delete" && open.id === item.id}
                    busy={busy === item.id}
                    onAsk={() => setOpen({ kind: "delete", id: item.id })}
                    onCancel={() => setOpen(null)}
                    onConfirm={() =>
                      void change(item.id, { type: "delete_item", id: item.id }).then((ok) => ok && setOpen(null))
                    }
                  />
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {adding ? (
        <MenuItemForm
          categories={categories}
          categoryId={category.id}
          busy={busy === `novo-${category.id}`}
          onSubmit={(fields) => saveItem(`novo-${category.id}`, fields)}
          onCancel={() => setOpen(null)}
        />
      ) : (
        <button
          type="button"
          className={cn(BUTTON.secondary, "self-start")}
          onClick={() => setOpen({ kind: "new_item", categoryId: category.id })}
          aria-label={`Novo item em ${category.name}`}
        >
          + Novo item
        </button>
      )}
    </section>
  );
};

type DeleteProps = {
  label: string;
  confirming: boolean;
  busy: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Excluir em dois passos: o primeiro clique só pergunta. */
const DeleteButton = ({ label, confirming, busy, onAsk, onCancel, onConfirm }: DeleteProps) =>
  confirming ? (
    <>
      <button
        type="button"
        className={cn(BUTTON.secondary, SMALL, "border-red-600 text-red-700 dark:text-red-300")}
        disabled={busy}
        onClick={onConfirm}
        aria-label={`Confirmar exclusão de ${label}`}
      >
        Confirmar exclusão
      </button>
      <button type="button" className={cn(BUTTON.ghost, SMALL)} onClick={onCancel}>
        Cancelar
      </button>
    </>
  ) : (
    <button type="button" className={cn(BUTTON.ghost, SMALL)} onClick={onAsk} aria-label={`Excluir ${label}`}>
      Excluir
    </button>
  );

const RenameForm = ({
  category,
  busy,
  onSubmit,
  onCancel,
}: {
  category: MenuCategory;
  busy: boolean;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(category.name);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(name.trim());
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end" aria-label={`Renomear ${category.name}`}>
      <label className="flex flex-1 flex-col gap-1">
        <span className={LABEL}>Nome da categoria</span>
        <input
          className={INPUT}
          required
          maxLength={MENU_LIMITS.categoryName}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit" className={BUTTON.primary} disabled={busy || !name.trim()}>
        Salvar
      </button>
      <button type="button" className={BUTTON.ghost} onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
};

const NewCategoryForm = ({
  busy,
  change,
}: {
  busy: boolean;
  change: (key: string, body: MenuChange) => Promise<boolean>;
}) => {
  const [name, setName] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await change("nova-categoria", { type: "save_category", name: name.trim() })) setName("");
  };
  return (
    <form
      onSubmit={submit}
      className={cn(CARD, "flex flex-col gap-2 p-4 sm:flex-row sm:items-end")}
      aria-label="Nova categoria"
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className={LABEL}>Nova categoria</span>
        <input
          className={INPUT}
          required
          maxLength={MENU_LIMITS.categoryName}
          placeholder="Ex.: Petiscos"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit" className={BUTTON.primary} disabled={busy || !name.trim()}>
        Criar categoria
      </button>
    </form>
  );
};
