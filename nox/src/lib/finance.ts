import type { Recurring, State, Transaction } from './types';
import { daysInMonth, monthKey, money, pad, parseISO, shiftMonth, today, toISO } from './format';

export const accountBalance = (s: State, accountId: string) => {
  const acc = s.accounts.find((a) => a.id === accountId);
  return s.transactions.reduce(
    (sum, t) => (t.accountId === accountId ? sum + (t.flow === 'income' ? t.amount : -t.amount) : sum),
    acc?.initialBalance ?? 0
  );
};

export const totalBalance = (s: State) => s.accounts.reduce((sum, a) => sum + accountBalance(s, a.id), 0);

export const inMonth = (s: State, month: string) => s.transactions.filter((t) => monthKey(t.date) === month);

export function monthTotals(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  const byCategory = new Map<string, number>();
  for (const t of txs) {
    if (t.flow === 'income') income += t.amount;
    else {
      expense += t.amount;
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
    }
  }
  return { income, expense, net: income - expense, byCategory };
}

export interface PendingItem {
  recurring: Recurring;
  due: string;
  overdue: boolean;
}

export interface FinancialPeriod {
  start: string;
  end: string;
  month: string;
  daysLeft: number;
}

export function financialPeriod(date = today(), dayStart = 1): FinancialPeriod {
  const parsed = parseISO(date);
  const day = Math.max(1, Math.min(31, dayStart));
  const startMonthDate = new Date(parsed.getFullYear(), parsed.getMonth() - (parsed.getDate() < day ? 1 : 0), 1);
  const startMonth = monthKey(toISO(startMonthDate));
  const start = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth(), Math.min(day, daysInMonth(startMonth)));
  const nextMonthDate = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const nextMonth = monthKey(toISO(nextMonthDate));
  const end = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), Math.min(day, daysInMonth(nextMonth)) - 1);
  const endIso = toISO(end);
  return {
    start: toISO(start),
    end: endIso,
    month: monthKey(toISO(start)),
    daysLeft: Math.max(1, Math.round((parseISO(endIso).getTime() - parsed.getTime()) / 864e5) + 1),
  };
}

export function transactionsInPeriod(s: State, period: FinancialPeriod) {
  return s.transactions.filter((t) => t.date >= period.start && t.date <= period.end);
}

export function pendingFixedBills(s: State, period = financialPeriod(), onDate = today()): PendingItem[] {
  const periodTransactions = transactionsInPeriod(s, period);
  const startMonth = monthKey(period.start);
  const endMonth = monthKey(period.end);
  const dueDates = [startMonth, ...(startMonth === endMonth ? [] : [endMonth])];
  return s.recurring
    .filter((r) => r.active)
    .flatMap((recurring) =>
      dueDates
        .map((month) => `${month}-${pad(Math.min(recurring.day, daysInMonth(month)))}`)
        .filter((due) => due >= period.start && due <= period.end)
        .filter((due) => !periodTransactions.some((t) => t.recurringId === recurring.id))
        .map((due) => ({ recurring, due, overdue: due < onDate }))
    )
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Recorrências ativas deste mês que ainda não foram lançadas. */
export function pendingRecurring(s: State, month = monthKey(today())): PendingItem[] {
  const t = today();
  const last = daysInMonth(month);
  const done = new Set(inMonth(s, month).map((x) => x.recurringId).filter(Boolean));
  return s.recurring
    .filter((r) => r.active && !done.has(r.id))
    .map((r) => {
      const due = `${month}-${pad(Math.min(r.day, last))}`;
      return { recurring: r, due, overdue: due < t };
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

/**
 * Quanto dá para gastar por dia até o fim do mês sem comprometer
 * contas fixas que ainda vão vencer nem a meta de economia.
 */
export function safeToSpend(s: State) {
  const t = today();
  const period = financialPeriod(t, s.settings.dayStart ?? 1);
  const totals = monthTotals(transactionsInPeriod(s, period));
  const pending = pendingFixedBills(s, period, t);
  const pendingIncome = pending.filter((p) => p.recurring.flow === 'income').reduce((x, p) => x + p.recurring.amount, 0);
  const pendingExpense = pending.filter((p) => p.recurring.flow === 'expense').reduce((x, p) => x + p.recurring.amount, 0);
  const expectedIncome = s.settings.monthlyIncome;
  const available = expectedIncome - totals.expense - pendingExpense - s.settings.monthlySavings;
  const daysLeft = period.daysLeft;
  const spentToday = s.transactions.filter((x) => x.date === t && x.flow === 'expense').reduce((x, y) => x + y.amount, 0);
  const perDay = Math.max(0, Math.floor(available / daysLeft));

  return {
    expectedIncome,
    available,
    pendingExpense,
    pendingIncome,
    daysLeft,
    perDay,
    leftToday: perDay - spentToday,
    hasPlan: expectedIncome > 0,
    period,
  };
}

/** Saldo estimado no último dia do mês, mantendo o ritmo de gastos variáveis. */
export function monthProjection(s: State) {
  const t = today();
  const month = monthKey(t);
  const day = Number(t.slice(8));
  const variable = inMonth(s, month)
    .filter((x) => x.flow === 'expense' && !x.recurringId)
    .reduce((a, x) => a + x.amount, 0);
  const daily = variable / Math.max(day, 1);
  const daysLeft = daysInMonth(month) - day;
  const sts = safeToSpend(s);
  return totalBalance(s) + sts.pendingIncome - sts.pendingExpense - Math.round(daily * daysLeft);
}

export function monthSeries(s: State, months = 6) {
  const cur = monthKey(today());
  return Array.from({ length: months }, (_, i) => {
    const m = shiftMonth(cur, i - months + 1);
    const { income, expense } = monthTotals(inMonth(s, m));
    return { month: m, income, expense };
  });
}

export const subscriptionsMonthly = (s: State) =>
  s.recurring.filter((r) => r.active && r.subscription && r.flow === 'expense').reduce((a, r) => a + r.amount, 0);

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: 'neutral' | 'good' | 'warn';
}

export function insights(s: State): Insight[] {
  const out: Insight[] = [];
  const t = today();
  const month = monthKey(t);
  const day = Number(t.slice(8));
  const dim = daysInMonth(month);
  const cat = (id: string) => s.categories.find((c) => c.id === id)?.name ?? 'Outros';

  // Orçamento no ritmo de estourar
  for (const b of s.budgets) {
    const spent = inMonth(s, month)
      .filter((x) => x.flow === 'expense' && x.categoryId === b.categoryId)
      .reduce((a, x) => a + x.amount, 0);
    if (spent >= b.limit) {
      out.push({ id: `over-${b.categoryId}`, tone: 'warn', title: `${cat(b.categoryId)} passou do limite`, body: `${money(spent - b.limit)} acima do orçamento de ${money(b.limit)}.` });
    } else if (day >= 5 && spent > 0) {
      const projected = (spent / day) * dim;
      if (projected > b.limit * 1.1) {
        const dayHit = Math.ceil(b.limit / (spent / day));
        out.push({ id: `pace-${b.categoryId}`, tone: 'warn', title: `${cat(b.categoryId)} em ritmo acelerado`, body: `Mantendo esse ritmo, o limite acaba por volta do dia ${dayHit}.` });
      }
    }
  }

  // Comparação justa com o mês anterior (até o mesmo dia)
  const prev = shiftMonth(month, -1);
  const prevSameDay = s.transactions.filter((x) => monthKey(x.date) === prev && Number(x.date.slice(8)) <= day);
  if (prevSameDay.length) {
    const a = monthTotals(inMonth(s, month)).byCategory;
    const b = monthTotals(prevSameDay).byCategory;
    let best: { id: string; diff: number; ratio: number } | null = null;
    for (const [id, v] of a) {
      const before = b.get(id) ?? 0;
      const diff = v - before;
      if (before > 0 && diff > 5000 && diff / before > 0.2 && (!best || diff > best.diff)) best = { id, diff, ratio: diff / before };
    }
    if (best) {
      out.push({ id: 'trend', tone: 'neutral', title: `Mais gastos com ${cat(best.id).toLowerCase()}`, body: `${money(best.diff)} a mais que no mesmo período do mês passado (+${Math.round(best.ratio * 100)}%).` });
    }
  }

  // Assinaturas
  const subs = subscriptionsMonthly(s);
  if (subs > 0) {
    const n = s.recurring.filter((r) => r.active && r.subscription).length;
    out.push({ id: 'subs', tone: 'neutral', title: `${n} assinatura${n > 1 ? 's' : ''} ativa${n > 1 ? 's' : ''}`, body: `Somam ${money(subs * 12)} por ano. Vale revisar o que você ainda usa.` });
  }

  // Taxa de poupança do mês passado
  const last = monthTotals(inMonth(s, prev));
  if (last.income > 0) {
    const rate = last.net / last.income;
    out.push(
      rate >= 0.1
        ? { id: 'rate', tone: 'good', title: `Você guardou ${Math.round(rate * 100)}% da renda`, body: `No mês passado sobraram ${money(last.net)}.` }
        : { id: 'rate', tone: 'warn', title: 'Pouca sobra no mês passado', body: `Apenas ${money(Math.max(last.net, 0))} ficaram livres. Uma meta mensal de economia ajuda.` }
    );
  }

  return out;
}

/** Meses até a meta, considerando a média guardada nos últimos 3 meses. */
export function goalEta(remaining: number, monthlyPace: number) {
  if (remaining <= 0) return 0;
  if (monthlyPace <= 0) return Infinity;
  return Math.ceil(remaining / monthlyPace);
}
