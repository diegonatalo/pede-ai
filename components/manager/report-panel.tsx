import { CARD, EMPTY } from "@/components/ui/styles";
import type { DayReport } from "@/lib/metrics";
import { formatCents } from "@/lib/money";

const minutes = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("pt-BR")} min`);

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className={`${CARD} flex flex-col gap-1 p-4`}>
    <dt className="text-sm text-muted">{label}</dt>
    <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    {hint && <dd className="text-xs text-muted">{hint}</dd>}
  </div>
);

/** Números do período: faturamento, movimento, tempos e os mais pedidos. */
export const ReportPanel = ({ report, periodLabel = "Hoje" }: { report: DayReport; periodLabel?: string }) => (
  <div className="flex flex-col gap-6">
    <section aria-labelledby="titulo-caixa" className="flex flex-col gap-3">
      <h2 id="titulo-caixa" className="text-lg font-bold">
        {periodLabel}
      </h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faturamento" value={formatCents(report.revenueCents)} hint="Comandas pagas, com taxa e couvert" />
        <Stat label="Comandas pagas" value={String(report.paidTabs)} />
        <Stat label="Pessoas atendidas" value={String(report.peopleServed)} />
        <Stat label="Média por pessoa" value={formatCents(report.averagePerPersonCents)} />
        <Stat
          label="Mesas atendidas"
          value={String(report.openTables + report.closedTables)}
          hint={report.openTables > 0 ? `${report.openTables} ainda abertas` : "Todas fechadas"}
        />
        <Stat label="Itens vendidos" value={String(report.itemsSold)} hint={`${report.canceledItems} cancelados`} />
        <Stat label="Tempo de preparo" value={minutes(report.averagePrepMinutes)} hint="Média, do início até pronto" />
        <Stat label="Tempo até a mesa" value={minutes(report.averageServeMinutes)} hint="Média, da cozinha até entregue" />
      </dl>
    </section>

    <section aria-labelledby="titulo-mais-pedidos" className="flex flex-col gap-3">
      <h2 id="titulo-mais-pedidos" className="text-lg font-bold">
        Mais pedidos
      </h2>
      {report.topItems.length === 0 ? (
        <p className={EMPTY}>Nenhum item vendido neste período.</p>
      ) : (
        <ol className={`${CARD} divide-y divide-border`}>
          {report.topItems.map((item, index) => (
            <li key={item.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="mr-2 text-muted">{index + 1}.</span>
                {item.name}
              </span>
              <span className="font-semibold tabular-nums">{item.quantity}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  </div>
);
