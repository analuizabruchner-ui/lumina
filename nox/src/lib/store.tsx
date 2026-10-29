import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Account, Budget, Category, Goal, Recurring, Settings, State, Transaction } from './types';
import { monthKey, pad, parseISO, shiftMonth, today, toISO, uid } from './format';

// Persistência ------------------------------------------------------------
// Hoje os dados ficam no aparelho. Para sincronizar entre usuários/aparelhos
// no futuro, basta trocar este adaptador por um que fale com um backend.

const KEY = 'nox:state';

const storage = {
  load(): State | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalizeState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  save(state: State) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* armazenamento indisponível */
    }
  },
};

// Padrões ---------------------------------------------------------------

export const PALETTE = ['#4D78FF'];

const defaultCategories = (): Category[] => [
  { id: 'c-moradia', name: 'Moradia', flow: 'expense', color: '#4D78FF' },
  { id: 'c-mercado', name: 'Mercado', flow: 'expense', color: '#4D78FF' },
  { id: 'c-alimentacao', name: 'Alimentação', flow: 'expense', color: '#4D78FF' },
  { id: 'c-transporte', name: 'Transporte', flow: 'expense', color: '#4D78FF' },
  { id: 'c-saude', name: 'Saúde', flow: 'expense', color: '#4D78FF' },
  { id: 'c-lazer', name: 'Lazer', flow: 'expense', color: '#4D78FF' },
  { id: 'c-assinaturas', name: 'Assinaturas', flow: 'expense', color: '#4D78FF' },
  { id: 'c-compras', name: 'Compras', flow: 'expense', color: '#4D78FF' },
  { id: 'c-educacao', name: 'Educação', flow: 'expense', color: '#4D78FF' },
  { id: 'c-outros', name: 'Outros', flow: 'expense', color: '#4D78FF' },
  { id: 'c-salario', name: 'Salário', flow: 'income', color: '#4D78FF' },
  { id: 'c-freela', name: 'Freela', flow: 'income', color: '#4D78FF' },
  { id: 'c-rendimentos', name: 'Rendimentos', flow: 'income', color: '#4D78FF' },
  { id: 'c-reembolso', name: 'Reembolso', flow: 'income', color: '#4D78FF' },
  { id: 'c-outros-ganhos', name: 'Outros', flow: 'income', color: '#4D78FF' },
];

const defaultSettings = (): Settings => ({
  name: '',
  hideValues: false,
  monthlySavings: 0,
  monthlyIncome: 0,
  hoursPerMonth: 176,
  monthlyYield: 0.9,
  dayStart: 1,
  reminders: true,
  hideOnOpen: false,
});

const emptyState = (): State => ({
  version: 1,
  onboarded: false,
  settings: defaultSettings(),
  accounts: [{ id: 'a-principal', name: 'Conta principal', kind: 'checking', initialBalance: 0 }],
  categories: defaultCategories(),
  transactions: [],
  recurring: [],
  budgets: [],
  goals: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const storedMoney = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(999_999_999, value) : 0;
const storedString = (value: unknown) => typeof value === 'string' ? value : '';
const validFlow = (value: unknown): value is 'expense' | 'income' => value === 'expense' || value === 'income';
const validISODate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toISO(parseISO(value)) === value;

function normalizeState(value: unknown): State {
  const defaults = emptyState();
  const saved = isRecord(value) ? value : {};
  const rawSettings = isRecord(saved.settings) ? saved.settings : {};
  const rawAccounts = Array.isArray(saved.accounts) ? saved.accounts : [];
  const rawCategories = Array.isArray(saved.categories) ? saved.categories : [];
  const rawTransactions = Array.isArray(saved.transactions) ? saved.transactions : [];
  const rawRecurring = Array.isArray(saved.recurring) ? saved.recurring : [];
  const rawBudgets = Array.isArray(saved.budgets) ? saved.budgets : [];
  const rawGoals = Array.isArray(saved.goals) ? saved.goals : [];
  const settings: Settings = {
    ...defaults.settings,
    ...rawSettings,
    name: storedString(rawSettings.name),
    hideValues: typeof rawSettings.hideValues === 'boolean' ? rawSettings.hideValues : defaults.settings.hideValues,
    monthlySavings: storedMoney(rawSettings.monthlySavings),
    monthlyIncome: storedMoney(rawSettings.monthlyIncome),
    hoursPerMonth: typeof rawSettings.hoursPerMonth === 'number' && Number.isFinite(rawSettings.hoursPerMonth) ? rawSettings.hoursPerMonth : defaults.settings.hoursPerMonth,
    monthlyYield: typeof rawSettings.monthlyYield === 'number' && Number.isFinite(rawSettings.monthlyYield) ? rawSettings.monthlyYield : defaults.settings.monthlyYield,
    dayStart: typeof rawSettings.dayStart === 'number' && Number.isInteger(rawSettings.dayStart) ? Math.min(31, Math.max(1, rawSettings.dayStart)) : 1,
  };
  const onboarded = saved.onboarded === true || Boolean(settings.name.trim() && settings.monthlyIncome > 0);
  const goals = rawGoals.filter((goal): goal is Record<string, unknown> => isRecord(goal))
    .filter((goal) => typeof goal.id === 'string' && typeof goal.name === 'string');
  const assigned = goals.reduce((sum, goal) => sum + storedMoney(goal.monthlyContribution), 0);
  const missing = goals.filter((goal) => typeof goal.monthlyContribution !== 'number').length;
  let remainder = Math.max(0, settings.monthlySavings - assigned);
  let remainingMissing = missing;
  const normalizedGoals = goals.map((goal) => {
    const monthlyContribution = typeof goal.monthlyContribution === 'number'
      ? storedMoney(goal.monthlyContribution)
      : remainingMissing ? Math.floor(remainder / remainingMissing) : 0;
    if (typeof goal.monthlyContribution !== 'number') {
      remainder -= monthlyContribution;
      remainingMissing -= 1;
    }
    const contributions = Array.isArray(goal.contributions)
      ? goal.contributions.filter((item): item is { date: string; amount: number } =>
        isRecord(item) && typeof item.date === 'string' && typeof item.amount === 'number' && Number.isFinite(item.amount))
        .map((item) => ({ date: item.date, amount: Math.trunc(item.amount) }))
      : [];
    return {
      id: goal.id as string,
      name: goal.name as string,
      target: storedMoney(goal.target),
      saved: storedMoney(goal.saved),
      deadline: typeof goal.deadline === 'string' && /^\d{4}-\d{2}$/.test(goal.deadline) ? goal.deadline : undefined,
      color: typeof goal.color === 'string' ? goal.color : '#4D78FF',
      monthlyContribution,
      contributions,
    };
  });
  const savedCategories = rawCategories.filter((category): category is Record<string, unknown> => isRecord(category))
    .filter((category) => typeof category.id === 'string' && typeof category.name === 'string' && validFlow(category.flow))
    .map((category) => ({
    ...category,
    name: category.id === 'c-freela' ? 'Freela' : category.id === 'c-outros-ganhos' ? 'Outros' : category.name as string,
    color: '#4D78FF',
  })) as Category[];
  const categories = [
    ...savedCategories,
    ...defaults.categories.filter((category) => !savedCategories.some((savedCategory) => savedCategory.id === category.id)),
  ];
  const accounts = rawAccounts.filter((account): account is Record<string, unknown> => isRecord(account))
    .filter((account) => typeof account.id === 'string' && typeof account.name === 'string' &&
      ['checking', 'savings', 'cash', 'investment'].includes(String(account.kind)))
    .map((account) => ({
      id: account.id as string,
      name: account.name as string,
      kind: account.kind as Account['kind'],
      initialBalance: storedMoney(account.initialBalance),
    }));
  const transactions = rawTransactions.filter((tx): tx is Record<string, unknown> => isRecord(tx))
    .filter((tx) => typeof tx.id === 'string' && validFlow(tx.flow) && validISODate(tx.date) && typeof tx.description === 'string')
    .map((tx) => ({
      ...tx,
      amount: storedMoney(tx.amount),
      categoryId: storedString(tx.categoryId),
      accountId: storedString(tx.accountId),
      createdAt: typeof tx.createdAt === 'number' ? tx.createdAt : 0,
      recurringId: typeof tx.recurringId === 'string' ? tx.recurringId : undefined,
      installment: isRecord(tx.installment) && typeof tx.installment.n === 'number' && typeof tx.installment.total === 'number'
        ? { n: Math.max(1, Math.trunc(tx.installment.n)), total: Math.max(1, Math.trunc(tx.installment.total)) }
        : undefined,
      payment: ['debit', 'pix', 'cash', 'card'].includes(String(tx.payment)) ? tx.payment : undefined,
    })) as Transaction[];
  const recurring = rawRecurring.filter((item): item is Record<string, unknown> => isRecord(item))
    .filter((item) => typeof item.id === 'string' && typeof item.name === 'string' && validFlow(item.flow))
    .map((item) => ({
      ...item,
      amount: storedMoney(item.amount),
      day: typeof item.day === 'number' ? Math.min(31, Math.max(1, Math.trunc(item.day))) : 1,
      categoryId: storedString(item.categoryId),
      accountId: storedString(item.accountId),
      subscription: item.subscription === true,
      active: item.active !== false,
    })) as Recurring[];
  const budgets = rawBudgets.filter((item): item is Record<string, unknown> => isRecord(item))
    .filter((item) => typeof item.categoryId === 'string' && typeof item.limit === 'number' && Number.isFinite(item.limit))
    .map((item) => ({ categoryId: item.categoryId as string, limit: storedMoney(item.limit) }));
  const rawDraft = isRecord(saved.onboardingDraft) ? saved.onboardingDraft : null;
  const onboardingDraft = rawDraft ? {
    step: typeof rawDraft.step === 'number' ? Math.min(4, Math.max(-1, Math.trunc(rawDraft.step))) : -1,
    name: storedString(rawDraft.name).slice(0, 30),
    income: storedMoney(rawDraft.income),
    variableIncome: rawDraft.variableIncome === true,
    savings: storedMoney(rawDraft.savings),
    balance: storedMoney(rawDraft.balance),
  } : undefined;
  return {
    ...defaults,
    version: 1,
    onboarded,
    onboardingDraft: onboarded ? undefined : onboardingDraft,
    settings,
    accounts: accounts.length ? accounts : defaults.accounts,
    categories,
    transactions,
    recurring,
    budgets,
    goals: normalizedGoals,
  };
}

export function sampleState(name = ''): State {
  const base = emptyState();
  const now = today();
  const cur = monthKey(now);
  const todayDay = Number(now.slice(8));
  const tx: Transaction[] = [];
  const add = (month: string, day: number, flow: Transaction['flow'], amount: number, description: string, categoryId: string, accountId = 'a-principal', recurringId?: string) => {
    if (month === cur && day > todayDay) return;
    tx.push({ id: uid(), flow, amount, date: `${month}-${pad(day)}`, description, categoryId, accountId, recurringId, createdAt: Date.now() });
  };

  const recurring: Recurring[] = [
    { id: 'r-salario', name: 'Salário', flow: 'income', amount: 780000, day: 5, categoryId: 'c-salario', accountId: 'a-principal', subscription: false, active: true },
    { id: 'r-aluguel', name: 'Aluguel', flow: 'expense', amount: 210000, day: 10, categoryId: 'c-moradia', accountId: 'a-principal', subscription: false, active: true },
    { id: 'r-internet', name: 'Internet', flow: 'expense', amount: 11990, day: 15, categoryId: 'c-moradia', accountId: 'a-principal', subscription: false, active: true },
    { id: 'r-energia', name: 'Energia', flow: 'expense', amount: 18400, day: 20, categoryId: 'c-moradia', accountId: 'a-principal', subscription: false, active: true },
    { id: 'r-streaming', name: 'Streaming de vídeo', flow: 'expense', amount: 5590, day: 12, categoryId: 'c-assinaturas', accountId: 'a-principal', subscription: true, active: true },
    { id: 'r-musica', name: 'Streaming de música', flow: 'expense', amount: 2190, day: 18, categoryId: 'c-assinaturas', accountId: 'a-principal', subscription: true, active: true },
    { id: 'r-nuvem', name: 'Armazenamento em nuvem', flow: 'expense', amount: 990, day: 25, categoryId: 'c-assinaturas', accountId: 'a-principal', subscription: true, active: true },
    { id: 'r-academia', name: 'Academia', flow: 'expense', amount: 11900, day: 8, categoryId: 'c-saude', accountId: 'a-principal', subscription: true, active: true },
  ];

  for (let back = 2; back >= 0; back--) {
    const m = shiftMonth(cur, -back);
    const k = back + 1;
    for (const r of recurring) add(m, r.day, r.flow, r.amount, r.name, r.categoryId, r.accountId, r.id);
    [3, 9, 16, 23, 28].forEach((d, i) => add(m, d, 'expense', 18000 + ((i * 3711 + k * 917) % 14000), 'Supermercado', 'c-mercado'));
    [2, 6, 11, 14, 19, 22, 26].forEach((d, i) => add(m, d, 'expense', 2800 + ((i * 1937 + k * 541) % 6500), i % 2 ? 'Restaurante' : 'Delivery', 'c-alimentacao'));
    [4, 12, 21].forEach((d, i) => add(m, d, 'expense', 4500 + ((i * 2113 + k * 333) % 9000), i === 1 ? 'Combustível' : 'Transporte por app', 'c-transporte'));
    add(m, 17, 'expense', 9000 + k * 4100, 'Cinema e jantar', 'c-lazer');
    add(m, 24, 'expense', 15990 + k * 2200, 'Roupas', 'c-compras');
    add(m, 27, 'income', 4210 + k * 310, 'Rendimento da reserva', 'c-rendimentos', 'a-reserva');
    if (back === 1) add(m, 13, 'income', 120000, 'Projeto de design', 'c-freela');
    if (back === 0) add(m, 7, 'expense', 34900, 'Curso online', 'c-educacao');
  }

  return {
    ...base,
    onboarded: true,
    settings: { ...base.settings, name, monthlyIncome: 780000, monthlySavings: 120000 },
    accounts: [
      { id: 'a-principal', name: 'Conta principal', kind: 'checking', initialBalance: 320000 },
      { id: 'a-reserva', name: 'Reserva', kind: 'savings', initialBalance: 1450000 },
      { id: 'a-carteira', name: 'Carteira', kind: 'cash', initialBalance: 15000 },
    ],
    transactions: tx,
    recurring,
    budgets: [
      { categoryId: 'c-mercado', limit: 110000 },
      { categoryId: 'c-alimentacao', limit: 45000 },
      { categoryId: 'c-transporte', limit: 30000 },
      { categoryId: 'c-lazer', limit: 25000 },
      { categoryId: 'c-compras', limit: 30000 },
    ],
    goals: [
      { id: uid(), name: 'Reserva de emergência', target: 3600000, saved: 1450000, color: '#5b8cff' },
      { id: uid(), name: 'Viagem', target: 800000, saved: 310000, deadline: `${shiftMonth(cur, 8)}-01`, color: '#3fb8af' },
      { id: uid(), name: 'Notebook novo', target: 900000, saved: 120000, deadline: `${shiftMonth(cur, 5)}-01`, color: '#c77dba' },
    ],
  };
}

// Contexto --------------------------------------------------------------

function useStoreValue() {
  const [state, setState] = useState<State>(() => storage.load() ?? emptyState());

  useEffect(() => storage.save(state), [state]);

  const update = useCallback((fn: (s: State) => State) => setState(fn), []);

  const actions = useMemo(
    () => ({
      saveOnboardingDraft: (onboardingDraft: NonNullable<State['onboardingDraft']>) =>
        update((s) => ({ ...s, onboardingDraft })),
      completeOnboarding: (patch: Partial<Settings>, initialBalance: number) =>
        update((s) => ({
          ...s,
          onboarded: true,
          onboardingDraft: undefined,
          settings: { ...s.settings, dayStart: 1, ...patch },
          accounts: s.accounts.length
            ? s.accounts.map((account, index) => (index === 0 ? { ...account, initialBalance } : account))
            : [{ id: 'a-principal', name: 'Conta principal', kind: 'checking', initialBalance }],
        })),
      loadSample: (name: string) => update(() => sampleState(name)),
      reset: () => update(() => emptyState()),
      importState: (next: State) => update(() => normalizeState(next)),

      updateSettings: (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      updateSavingsPlan: (monthlySavings: number, patch: Partial<Settings> = {}) => update((s) => {
        if (!s.goals.length) return { ...s, settings: { ...s.settings, ...patch, monthlySavings } };
        const currentTotal = s.goals.reduce((sum, goal) => sum + (goal.monthlyContribution ?? 0), 0);
        const weights = s.goals.map((goal) => currentTotal > 0 ? (goal.monthlyContribution ?? 0) : 1);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let remainder = monthlySavings;
        const goals = s.goals.map((goal, index) => {
          const amount = index === s.goals.length - 1
            ? remainder
            : Math.floor(monthlySavings * weights[index] / totalWeight);
          remainder -= amount;
          return { ...goal, monthlyContribution: amount };
        });
        return { ...s, settings: { ...s.settings, ...patch, monthlySavings }, goals };
      }),
      toggleHidden: () => update((s) => ({ ...s, settings: { ...s.settings, hideValues: !s.settings.hideValues } })),
      setHidden: (hideValues: boolean) => update((s) => ({ ...s, settings: { ...s.settings, hideValues } })),
      updateCategory: (category: Category) => update((s) => ({
        ...s,
        categories: s.categories.map((item) => item.id === category.id ? category : item),
      })),
      addCategory: (category: Omit<Category, 'id'> & { id?: string }) => update((s) => ({
        ...s,
        categories: [...s.categories, { ...category, id: category.id ?? uid() }],
      })),

      saveTransaction: (t: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) =>
        update((s) => {
          if (t.id && s.transactions.some((x) => x.id === t.id)) {
            return { ...s, transactions: s.transactions.map((x) => (x.id === t.id ? { ...x, ...t, id: x.id } : x)) };
          }
          return { ...s, transactions: [...s.transactions, { ...t, id: t.id ?? uid(), createdAt: Date.now() }] };
        }),
      removeTransaction: (id: string) => update((s) => ({ ...s, transactions: s.transactions.filter((x) => x.id !== id) })),
      undoTransactions: (ids: string[], recurringId?: string) =>
        update((s) => ({
          ...s,
          transactions: s.transactions.filter((transaction) => !ids.includes(transaction.id)),
          recurring: recurringId ? s.recurring.filter((recurring) => recurring.id !== recurringId) : s.recurring,
        })),

      saveRecurring: (r: Omit<Recurring, 'id'> & { id?: string }) =>
        update((s) => {
          if (r.id && s.recurring.some((x) => x.id === r.id)) {
            return { ...s, recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, ...r, id: x.id } : x)) };
          }
          return { ...s, recurring: [...s.recurring, { ...r, id: r.id ?? uid() }] };
        }),
      removeRecurring: (id: string) => update((s) => ({ ...s, recurring: s.recurring.filter((x) => x.id !== id) })),
      settleRecurring: (r: Recurring, date: string) =>
        update((s) => s.transactions.some((transaction) => transaction.recurringId === r.id && monthKey(transaction.date) === monthKey(date))
          ? s
          : ({
            ...s,
            transactions: [
              ...s.transactions,
              { id: uid(), flow: r.flow, amount: r.amount, date, description: r.name, categoryId: r.categoryId, accountId: r.accountId, recurringId: r.id, createdAt: Date.now() },
            ],
          })),
      unsettleRecurring: (recurringId: string, month: string) =>
        update((s) => ({
          ...s,
          transactions: s.transactions.filter((t) => !(t.recurringId === recurringId && t.date.slice(0, 7) === month)),
        })),

      setBudget: (b: Budget) =>
        update((s) => ({
          ...s,
          budgets: b.limit > 0 ? [...s.budgets.filter((x) => x.categoryId !== b.categoryId), b] : s.budgets.filter((x) => x.categoryId !== b.categoryId),
        })),

      saveGoal: (g: Omit<Goal, 'id'> & { id?: string }) =>
        update((s) => {
          if (g.id && s.goals.some((x) => x.id === g.id)) {
            return { ...s, goals: s.goals.map((x) => (x.id === g.id ? { ...x, ...g, id: x.id } : x)) };
          }
          return { ...s, goals: [...s.goals, { ...g, id: uid() }] };
        }),
      removeGoal: (id: string) => update((s) => ({ ...s, goals: s.goals.filter((x) => x.id !== id) })),
      contributeGoal: (id: string, amount: number) =>
        update((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? {
          ...g,
          saved: Math.max(0, g.saved + amount),
          contributions: [...(g.contributions ?? []), { date: today(), amount }],
        } : g)) })),

      saveAccount: (a: Omit<Account, 'id'> & { id?: string }) =>
        update((s) => {
          if (a.id && s.accounts.some((x) => x.id === a.id)) {
            return { ...s, accounts: s.accounts.map((x) => (x.id === a.id ? { ...x, ...a, id: x.id } : x)) };
          }
          return { ...s, accounts: [...s.accounts, { ...a, id: uid() }] };
        }),
      removeAccount: (id: string) =>
        update((s) =>
          s.accounts.length <= 1 ||
          s.transactions.some((t) => t.accountId === id) ||
          s.recurring.some((r) => r.accountId === id)
            ? s
            : { ...s, accounts: s.accounts.filter((a) => a.id !== id) }
        ),
    }),
    [update]
  );

  return { state, actions };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore fora do StoreProvider');
  return v;
}
