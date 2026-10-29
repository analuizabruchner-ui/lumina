// Valores monetários sempre em centavos (inteiros). Datas em 'YYYY-MM-DD'.

export type Flow = 'expense' | 'income';

export type AccountKind = 'checking' | 'savings' | 'cash' | 'investment';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  initialBalance: number;
}

export interface Category {
  id: string;
  name: string;
  flow: Flow;
  color: string;
  hidden?: boolean;
}

export interface Transaction {
  id: string;
  flow: Flow;
  amount: number;
  date: string;
  description: string;
  categoryId: string;
  accountId: string;
  recurringId?: string;
  payment?: 'debit' | 'pix' | 'cash' | 'card';
  installment?: { n: number; total: number };
  createdAt: number;
}

export interface Recurring {
  id: string;
  name: string;
  flow: Flow;
  amount: number;
  day: number;
  categoryId: string;
  accountId: string;
  subscription: boolean;
  active: boolean;
  automaticDebit?: boolean;
}

export interface Budget {
  categoryId: string;
  limit: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline?: string;
  color: string;
  monthlyContribution?: number;
  contributions?: { date: string; amount: number }[];
}

export interface Settings {
  name: string;
  hideValues: boolean;
  monthlySavings: number;
  monthlyIncome: number;
  variableIncome?: boolean;
  dateStart?: string;
  hoursPerMonth: number;
  monthlyYield: number; // rendimento mensal de referência, em % (ex.: 0.9)
  dayStart?: number;
  reminders?: boolean;
  hideOnOpen?: boolean;
  lastBackup?: string;
}

export interface State {
  version: 1;
  onboarded: boolean;
  onboardingDraft?: {
    step: number;
    name: string;
    income: number;
    variableIncome: boolean;
    savings: number;
    balance: number;
  };
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  budgets: Budget[];
  goals: Goal[];
}
