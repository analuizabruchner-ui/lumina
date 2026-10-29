const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const money = (cents: number) => brl.format(cents / 100);
export const moneyShort = (cents: number) =>
  Math.abs(cents) >= 1_000_000 ? brlShort.format(cents / 100) : money(cents);

export const pct = (v: number, digits = 0) =>
  `${v.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Datas ------------------------------------------------------------------

export const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => toISO(new Date());

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const daysBetween = (from: string, to: string) => {
  const start = parseISO(from);
  const end = parseISO(to);
  return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 864e5);
};

export const monthKey = (s: string) => s.slice(0, 7);

export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const daysInMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const name = MONTHS[m - 1];
  return y === new Date().getFullYear() ? cap(name) : `${cap(name)} ${y}`;
};

export const dayLabel = (iso: string) => {
  const t = today();
  if (iso === t) return 'Hoje';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = toISO(yesterday);
  if (iso === y) return 'Ontem';
  const d = parseISO(iso);
  return `${cap(WEEKDAYS[d.getDay()])}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

export const shortDate = (iso: string) => {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
