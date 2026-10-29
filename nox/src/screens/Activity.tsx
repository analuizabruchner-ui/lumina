import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { inMonth, monthSeries, monthTotals } from '../lib/finance';
import { daysBetween, monthKey, monthLabel, shiftMonth, today } from '../lib/format';
import { Icon } from '../components/Icon';
import { Empty, Money, Segmented } from '../components/ui';
import { TxRow } from './Home';
import type { Transaction } from '../lib/types';

type Filter = 'all' | 'expense' | 'income';

export function Activity({ onOpenTx }: { onOpenTx: (tx?: Transaction) => void }) {
  const { state, actions } = useStore();
  const current = monthKey(today());
  const [month, setMonth] = useState(current);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStart = useRef<number | null>(null);
  const series = useMemo(() => monthSeries(state, 6), [state]);
  const maxSeries = Math.max(1, ...series.map((item) => item.expense));
  const previousMonth = shiftMonth(month, -1);
  const totals = monthTotals(inMonth(state, month));
  const previousExpense = monthTotals(inMonth(state, previousMonth)).expense;
  const difference = totals.expense - previousExpense;
  const { groups } = useMemo(() => {
    const txs = inMonth(state, month);
    const q = query.trim().toLocaleLowerCase('pt-BR');
    const visible = txs
      .filter((tx) => filter === 'all' || tx.flow === filter)
      .filter((tx) => {
        if (!q) return true;
        const category = state.categories.find((item) => item.id === tx.categoryId)?.name ?? '';
        return tx.description.toLocaleLowerCase('pt-BR').includes(q) || category.toLocaleLowerCase('pt-BR').includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const map = new Map<string, Transaction[]>();
    for (const tx of visible) map.set(tx.date, [...(map.get(tx.date) ?? []), tx]);
    return { groups: [...map.entries()] };
  }, [state, month, filter, query]);

  return (
    <div className="screen activity-screen">
      <header className="activity-header">
        <h1 className="title">Extrato</h1>
        <div className="month-nav">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior"><Icon name="chevronLeft" size={18} /></button>
          <strong>{formatMonthAndYear(month)}</strong>
          <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= current} aria-label="Próximo mês"><Icon name="chevronRight" size={18} /></button>
        </div>
      </header>

      <div className="extract-totals">
        <div><span>Entradas</span><strong className="income-value"><Money value={totals.income} /></strong></div>
        <div><span>Saídas</span><strong><Money value={totals.expense} /></strong></div>
        <div><span>Sobrou</span><strong className={totals.net >= 0 ? 'income-value' : 'danger-text'}><Money value={totals.net} signed /></strong></div>
      </div>

      <section className="extract-chart-section">
        <div className="extract-chart-caption">
          <h2>Gastos por mês</h2>
          {previousExpense > 0 && (
            <span className={difference <= 0 ? 'income-value' : 'attention-text'}>
              <Money value={Math.abs(difference)} /> {difference <= 0 ? 'a menos' : 'a mais'} que {monthLabel(previousMonth).toLowerCase().split(' ')[0]}
            </span>
          )}
        </div>
        <div className="extract-chart" aria-label="Gastos dos últimos seis meses">
          {series.map((item) => {
            const height = Math.max(2, item.expense ? (item.expense / maxSeries) * 72 : 0);
            return (
              <button key={item.month} className={`extract-chart-column ${month === item.month ? 'on' : ''}`} onClick={() => setMonth(item.month)} aria-label={`Selecionar ${monthLabel(item.month)}`}>
                <i style={{ height }} />
                <span>{monthLabel(item.month).slice(0, 3)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <label className="search">
        <Icon name="search" size={19} />
        <input placeholder="Buscar por descrição ou categoria" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <Segmented value={filter} onChange={setFilter} options={[
        { value: 'all', label: 'Tudo' },
        { value: 'expense', label: 'Saídas' },
        { value: 'income', label: 'Entradas' },
      ]} />

      {groups.length === 0 ? (
        <div className="extract-empty">
          <Empty title="Nada por aqui ainda." text="Toque no + para registrar o primeiro gasto do mês." />
        </div>
      ) : groups.map(([date, transactions]) => (
        <section key={date} className="extract-day">
          <div className="day-head">{dayHeading(date)}</div>
          <div className="extract-list">
            {transactions.map((tx) => (
              <div
                className={`swipe-row ${swipedId === tx.id ? 'revealed' : ''}`}
                key={tx.id}
                onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; }}
                onTouchEnd={(event) => {
                  const end = event.changedTouches[0]?.clientX;
                  if (touchStart.current !== null && end !== undefined && touchStart.current - end > 48) setSwipedId(tx.id);
                  if (touchStart.current !== null && end !== undefined && end - touchStart.current > 48) setSwipedId(null);
                }}
              >
                <TxRow t={tx} showDate={false} onClick={() => { setSwipedId(null); onOpenTx(tx); }} />
                <button className="swipe-delete" onClick={() => { actions.removeTransaction(tx.id); setSwipedId(null); }}>Apagar</button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function formatMonthAndYear(month: string) {
  const [year, value] = month.split('-').map(Number);
  const name = new Date(year, value - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

function dayHeading(iso: string) {
  const day = new Date(`${iso}T00:00:00`);
  const diff = daysBetween(iso, today());
  const dateLabel = `${day.getDate()} de ${day.toLocaleDateString('pt-BR', { month: 'long' })}`;
  const label = diff === 0 ? 'Hoje' : diff === 1 ? 'Ontem' : day.toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${label} · ${dateLabel}`;
}
