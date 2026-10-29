import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useStore } from '../lib/store';
import { money } from '../lib/format';
import type { Category } from '../lib/types';

export function Sheet({ title, onClose, children, action }: { title?: string; onClose: () => void; children: ReactNode; action?: ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = () => {
    if (window.history.state?.noxSheet) window.history.back();
    else closeRef.current();
  };
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.history.pushState({ ...(window.history.state ?? {}), noxSheet: true }, '', window.location.href);
    const onPop = () => closeRef.current();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  return createPortal(
    <>
      <div className="backdrop" onClick={close} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        <div className="sheet-head">
          <button className="icon-btn" onClick={close} aria-label="Fechar" style={{ marginLeft: -10 }}>
            <Icon name="close" size={20} />
          </button>
          {title && <h2>{title}</h2>}
          <div style={{ minWidth: 40, display: 'flex', justifyContent: 'flex-end' }}>{action}</div>
        </div>
        {children}
      </div>
    </>,
    document.body
  );
}

/** Valor monetário que respeita o modo privado. */
export function Money({ value, signed, className = '', split }: { value: number; signed?: boolean; className?: string; split?: boolean }) {
  const { state } = useStore();
  if (state.settings.hideValues) return <span className={`num hidden-val ${className}`}>R$ •••••</span>;
  const text = money(Math.abs(value));
  const sign = signed ? (value > 0 ? '+ ' : value < 0 ? '− ' : '') : value < 0 ? '− ' : '';
  if (split) {
    const [int, cents] = text.split(',');
    return (
      <span className={`num ${className}`}>
        {sign}
        {int}
        <span className="cents">,{cents}</span>
      </span>
    );
  }
  return (
    <span className={`num ${className}`}>
      {sign}
      {text}
    </span>
  );
}

export function Mono({ category, size = 36 }: { category?: Category; size?: number }) {
  const icon = categoryIconName(category?.name ?? '');
  return (
    <span className="mono" style={{ width: size, height: size }}>
      <Icon name={icon} size={18} />
    </span>
  );
}

export function categoryIconName(name: string): string {
  const value = name.toLocaleLowerCase('pt-BR');
  if (value.includes('moradia')) return 'home';
  if (value.includes('mercado')) return 'shoppingCart';
  if (value.includes('alimenta')) return 'utensils';
  if (value.includes('transporte')) return 'car';
  if (value.includes('saúde')) return 'heart';
  if (value.includes('lazer')) return 'clapperboard';
  if (value.includes('assinatura')) return 'repeat';
  if (value.includes('compra')) return 'shoppingBag';
  if (value.includes('educa')) return 'graduationCap';
  if (value.includes('salário')) return 'wallet';
  if (value.includes('freela')) return 'briefcase';
  if (value.includes('rendimento')) return 'trend';
  return 'grid';
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} />;
}

export function Bar({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0;
  return (
    <div className="bar">
      <i style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

/** Teclado numérico estilo banco: os dígitos entram pelos centavos. */
export function AmountPad({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const maxAmount = 999_999_999;
  const press = (k: string) => {
    if (k === 'del') return onChange(Math.floor(value / 10));
    if (k === '00') return onChange(Math.min(maxAmount, value * 100));
    onChange(Math.min(maxAmount, value * 10 + Number(k)));
  };
  return (
    <div className="keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'].map((k) => (
        <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? 'Apagar' : k}>
          {k === 'del' ? <Icon name="backspace" size={24} /> : k}
        </button>
      ))}
    </div>
  );
}

/** Campo monetário de texto (para formulários e ferramentas). */
export function MoneyInput({ value, onChange, placeholder = '0,00' }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  const { state } = useStore();
  const [text, setText] = useState(value ? (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  useEffect(() => {
    const parsed = parseMoney(text);
    if (parsed !== value) setText(value ? (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="input-prefix">
      <b>R$</b>
      <input
        className={`input num ${state.settings.hideValues ? 'masked-input' : ''}`}
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMoney(e.target.value));
        }}
      />
    </div>
  );
}

export function NumberInput({ value, onChange, suffix, step = 'any' }: { value: number; onChange: (v: number) => void; suffix?: string; step?: string }) {
  const [text, setText] = useState(String(value).replace('.', ','));
  return (
    <div className="input-suffix">
      <input
        className="input num"
        inputMode="decimal"
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(/\./g, '').replace(',', '.'));
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
      {suffix && <b>{suffix}</b>}
    </div>
  );
}

export const parseMoney = (s: string) => {
  const clean = s.replace(/[^\d,.]/g, '');
  const comma = clean.indexOf(',');
  const dot = clean.lastIndexOf('.');
  let whole: string;
  let fraction: string;
  if (comma >= 0) {
    whole = clean.slice(0, comma).replace(/\D/g, '');
    fraction = clean.slice(comma + 1).replace(/\D/g, '').slice(0, 2);
  } else if (dot >= 0 && clean.length - dot - 1 < 3) {
    whole = clean.slice(0, dot).replace(/\D/g, '');
    fraction = clean.slice(dot + 1).replace(/\D/g, '').slice(0, 2);
  } else {
    whole = clean.replace(/\D/g, '');
    fraction = '';
  }
  const cents = Number(whole || 0) * 100 + Number(fraction.padEnd(2, '0') || 0);
  return Number.isSafeInteger(cents) ? Math.min(999_999_999, cents) : 999_999_999;
};

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
