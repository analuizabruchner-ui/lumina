import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { monthTotals, pendingFixedBills, safeToSpend, totalBalance, transactionsInPeriod } from '../lib/finance';
import { daysBetween, greeting, shortDate, today } from '../lib/format';
import { Icon } from '../components/Icon';
import { Bar, Money, Mono } from '../components/ui';
import type { Transaction } from '../lib/types';

interface Props {
  onOpenTx: (tx?: Transaction) => void;
  onNavigate: (tab: 'activity' | 'plan') => void;
  onSettings: () => void;
}

export function Home({ onOpenTx, onNavigate, onSettings }: Props) {
  const { state, actions } = useStore();
  const data = useMemo(() => {
    const sts = safeToSpend(state);
    const periodTransactions = transactionsInPeriod(state, sts.period);
    const totals = monthTotals(periodTransactions);
    const limit = Math.max(0, state.settings.monthlyIncome - state.settings.monthlySavings);
    const pending = pendingFixedBills(state, sts.period).filter((item) => item.recurring.flow === 'expense').slice(0, 3);
    const recent = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 3);
    const saved = state.goals.reduce((sum, goal) => sum + (goal.contributions ?? [])
      .filter((contribution) => contribution.date >= sts.period.start && contribution.date <= sts.period.end)
      .reduce((goalSum, contribution) => goalSum + contribution.amount, 0), 0);
    return { sts, totals, limit, pending, recent, balance: totalBalance(state), saved: Math.max(0, saved) };
  }, [state]);
  const { settings } = state;
  const hasTransactions = data.recent.length > 0;
  const closeDate = data.sts.period.end;
  const remaining = Math.max(0, data.limit - data.totals.expense);
  const progressColor = data.totals.expense > data.limit
    ? 'var(--acima)'
    : data.limit > 0 && data.totals.expense / data.limit >= 0.9 ? 'var(--atencao)' : 'var(--lua)';

  return (
    <div className="screen home-screen">
      <div className="home-moon" aria-hidden="true" />
      <header className="topbar">
        <img className="wordmark" src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="NOX" />
        <div className="actions">
          <button className="icon-btn" onClick={actions.toggleHidden} aria-label={settings.hideValues ? 'Mostrar valores' : 'Ocultar valores'}>
            <Icon name={settings.hideValues ? 'eyeOff' : 'eye'} size={22} />
          </button>
          <button className="icon-btn notification-button" onClick={() => onNavigate('plan')} aria-label="Avisos de contas">
            <Icon name="bell" size={22} />
            {data.pending.length > 0 && <span className="notification-dot" />}
          </button>
        </div>
      </header>

      <section className="home-hero">
        <p>{greeting()}{settings.name ? `, ${settings.name.split(' ')[0]}` : ''}. Hoje você pode gastar</p>
        {data.sts.available < 0 ? (
          <h1 className="hero-amount over-budget">Você passou <Money value={Math.abs(data.sts.available)} /> do planejado</h1>
        ) : (
          <h1 className="hero-amount"><Money value={data.sts.perDay} /></h1>
        )}
        {data.sts.available >= 0 && (
          <p className="support-text">Por dia até {shortDate(closeDate)}, já descontando as contas que ainda vão vencer.</p>
        )}
      </section>

      <section className="home-month">
        <div className="section-head">
          <h2>Gasto no mês</h2>
          <span className="home-month-total"><Money value={data.totals.expense} /> de <Money value={data.limit} /></span>
        </div>
        <Bar value={data.totals.expense} max={data.limit} color={progressColor} />
      </section>

      <section className="home-summary">
        <div>
          <span>Saldo atual</span>
          <strong><Money value={data.balance} /></strong>
        </div>
        <div>
          <span>Guardado no mês</span>
          <strong className="income-value"><Money value={data.saved} /></strong>
        </div>
      </section>

      {hasTransactions ? (
        <>
          <section className="section">
            <div className="section-head">
              <h2>Próximas contas</h2>
              <button className="link" onClick={() => onNavigate('plan')}>Ver todas</button>
            </div>
            {data.pending.length ? (
              <div className="list">
                {data.pending.map(({ recurring, due, overdue }) => {
                  const days = daysBetween(today(), due);
                  return (
                    <div className="row" key={`${recurring.id}-${due}`}>
                      <Mono category={state.categories.find((category) => category.id === recurring.categoryId)} size={40} />
                      <div className="grow">
                        <div className="primary">{recurring.name}</div>
                        <div className={`secondary ${overdue ? 'danger-text' : days <= 3 ? 'attention-text' : ''}`}>
                          {overdue ? `Venceu há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}` : days === 0 ? 'Vence hoje' : `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`} · {shortDate(due)}
                        </div>
                      </div>
                      <div className="end"><Money value={-recurring.amount} /></div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="support-text">Nenhuma conta pendente neste mês.</p>}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Últimas movimentações</h2>
              <button className="link" onClick={() => onNavigate('activity')}>Extrato</button>
            </div>
            <div className="list">
              {data.recent.map((tx) => (
                <TxRow key={tx.id} t={tx} onClick={() => onOpenTx(tx)} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="home-empty">
          <p>Seu primeiro gasto aparece aqui.</p>
          <button className="btn secondary" onClick={() => onOpenTx()}>
            <Icon name="plus" size={18} /> Registrar um gasto
          </button>
        </section>
      )}
    </div>
  );
}

export function TxRow({ t, onClick, showDate = true }: { t: Transaction; onClick: () => void; showDate?: boolean }) {
  const { state } = useStore();
  const category = state.categories.find((c) => c.id === t.categoryId);
  const meta = [category?.name, showDate ? shortDate(t.date) : undefined, t.installment ? `${t.installment.n}/${t.installment.total}` : undefined].filter(Boolean).join(' · ');
  return (
    <button className="row" onClick={onClick}>
      <span className={`transaction-icon ${t.flow === 'income' ? 'income-icon' : ''}`}>
        <Icon name={t.flow === 'income' ? 'arrowDownLeft' : 'arrowUpRight'} size={20} />
      </span>
      <span className="grow">
        <span className="primary">{t.description}</span>
        <span className="secondary">{meta}</span>
      </span>
      <span className="end">
        <Money value={t.flow === 'income' ? t.amount : -t.amount} signed={t.flow === 'income'} className={t.flow === 'income' ? 'pos' : ''} />
      </span>
    </button>
  );
}
