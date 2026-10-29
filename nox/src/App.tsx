import { useEffect, useRef, useState, type RefObject } from 'react';
import { Activity } from './screens/Activity';
import { Home } from './screens/Home';
import { Plan } from './screens/Plan';
import { Icon } from './components/Icon';
import { MoneyInput, Sheet, Switch } from './components/ui';
import { TransactionSheet } from './components/TransactionSheet';
import { useStore } from './lib/store';
import { money, today } from './lib/format';
import type { Category, Flow, State, Transaction } from './lib/types';

type Tab = 'home' | 'activity' | 'plan' | 'settings';

export function App() {
  const { state, actions } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [planInitialView, setPlanInitialView] = useState<'budgets' | 'goals' | 'fixed'>('budgets');
  const [transaction, setTransaction] = useState<Transaction | null | undefined>(undefined);
  const [entered, setEntered] = useState(false);
  const [toast, setToast] = useState<{ ids: string[]; recurringId?: string; message: string } | null>(null);

  useEffect(() => {
    if (state.onboarded && state.settings.hideOnOpen) actions.setHidden(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>('.screen')?.scrollTo({ top: 0 });
  }, [tab]);

  const undo = () => {
    if (toast) actions.undoTransactions(toast.ids, toast.recurringId);
    setToast(null);
  };

  return (
    <main className="app">
      <div className={`app-content ${entered ? '' : 'app-content-entering'}`}>
        {state.onboarded ? (
          <>
            {tab === 'home' && <Home onOpenTx={(tx) => setTransaction(tx ?? null)} onNavigate={(next) => {
              if (next === 'plan') setPlanInitialView('fixed');
              setTab(next);
            }} onSettings={() => setTab('settings')} />}
            {tab === 'activity' && <Activity onOpenTx={(tx) => setTransaction(tx)} />}
            {tab === 'plan' && <Plan initialView={planInitialView} />}
            {tab === 'settings' && <Settings />}
            <nav className="tabbar" aria-label="Navegação principal">
              <button className={`tab ${tab === 'home' ? 'on' : ''}`} onClick={() => setTab('home')}><Icon name="home" size={22} /><span>Início</span></button>
              <button className={`tab ${tab === 'activity' ? 'on' : ''}`} onClick={() => setTab('activity')}><Icon name="list" size={22} /><span>Extrato</span></button>
              <button className="tab-add" onClick={() => setTransaction(null)} aria-label="Novo gasto"><Icon name="plus" size={26} /></button>
              <button className={`tab ${tab === 'plan' ? 'on' : ''}`} onClick={() => { setPlanInitialView('budgets'); setTab('plan'); }}><Icon name="target" size={22} /><span>Planejamento</span></button>
              <button className={`tab ${tab === 'settings' ? 'on' : ''}`} onClick={() => setTab('settings')}><Icon name="settings" size={22} /><span>Ajustes</span></button>
            </nav>
          </>
        ) : <Onboarding />}
      </div>
      {!entered && <Welcome onEnter={() => setEntered(true)} />}
      {transaction !== undefined && (
        <TransactionSheet
          initial={transaction ?? undefined}
          onClose={() => setTransaction(undefined)}
          onSaved={(result) => { setTransaction(undefined); if (result.ids.length || result.recurringId) setToast(result); }}
        />
      )}
      {toast && (
        <div className="undo-toast" role="status">
          <span>{toast.message}</span>
          <button onClick={undo}>Desfazer</button>
        </div>
      )}
    </main>
  );
}

function Welcome({ onEnter }: { onEnter: () => void }) {
  return (
    <section className="opening" aria-label="Abertura do NOX" onAnimationEnd={(event) => {
      if (event.target === event.currentTarget && event.animationName === 'opening-dissolve') onEnter();
    }}>
      <svg className="opening-wordmark" viewBox="0 0 260 100" role="img" aria-label="NOX">
        <path className="opening-letter opening-letter-n" d="M12 85V31c0-10 5-15 13-15s13 5 13 15v1c8-11 19-16 33-16 16 0 23 10 23 23v30" />
        <circle className="opening-letter opening-letter-o" cx="137" cy="50" r="34" />
        <path className="opening-letter opening-letter-x" d="m183 20 63 60m0-60-63 60" />
      </svg>
    </section>
  );
}

function Onboarding() {
  const { state, actions } = useStore();
  const draft = state.onboardingDraft;
  const [step, setStep] = useState(draft?.step ?? -1);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [name, setName] = useState(draft?.name ?? '');
  const [income, setIncome] = useState(draft?.income ?? 0);
  const [variableIncome, setVariableIncome] = useState(draft?.variableIncome ?? false);
  const [savings, setSavings] = useState(draft?.savings ?? 0);
  const [balance, setBalance] = useState(draft?.balance ?? 0);
  const [balanceEntered, setBalanceEntered] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const cleanedName = name.trim();
  const validName = /\p{L}/u.test(cleanedName);
  const savingsTooHigh = savings >= income;
  const isValid = step === 0 ? validName : step === 1 ? income > 0 : step === 2 ? !savingsTooHigh : step === 3 ? balanceEntered : true;

  useEffect(() => {
    if (window.history.state?.noxOnboardingEntry !== true) {
      window.history.pushState({ noxOnboardingEntry: true }, '', window.location.href);
    }
    const handlePopState = () => {
      const current = stepRef.current;
      if (current <= -1) return;
      window.history.pushState({ noxOnboardingEntry: true }, '', window.location.href);
      setDirection('back');
      setStep(current === 4 ? 3 : current - 1);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    actions.saveOnboardingDraft({ step, name, income, variableIncome, savings, balance });
  }, [actions, balance, income, name, savings, step, variableIncome]);

  useEffect(() => {
    if (step >= 0 && step <= 3) inputRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateKeyboardOffset = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty('--onboarding-button-offset', `${keyboardHeight > 100 ? keyboardHeight + 16 : 36}px`);
    };
    updateKeyboardOffset();
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);
    window.addEventListener('resize', updateKeyboardOffset);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
      window.removeEventListener('resize', updateKeyboardOffset);
      document.documentElement.style.removeProperty('--onboarding-button-offset');
    };
  }, []);

  const goTo = (nextStep: number) => {
    setDirection(nextStep < step ? 'back' : 'forward');
    setStep(nextStep);
  };
  const finish = () => {
    const formattedName = cleanedName.charAt(0).toLocaleUpperCase('pt-BR') + cleanedName.slice(1);
    actions.completeOnboarding({
      name: formattedName,
      monthlyIncome: income,
      variableIncome,
      monthlySavings: savings,
      dayStart: 1,
      dateStart: today(),
    }, balance);
    void navigator.storage?.persist?.().catch(() => undefined);
    window.history.replaceState({ noxHome: true }, '', window.location.href);
  };
  const suggestions = [10, 15, 20].map((rate) => ({
    rate,
    amount: Math.round(income * rate / 10000) * 100,
  }));
  const selectedSuggestion = suggestions.find(({ amount }) => amount === savings)?.rate;
  const incomeLabel = money(income).replace(/,00$/, '');
  const savingsPercent = income > 0 ? Math.round((savings / income) * 100) : 0;

  if (step === -1) return (
    <section className={`onboard onboarding-welcome onboarding-${direction}`} aria-label="Boas-vindas ao NOX">
      <div className="onboarding-moon" aria-hidden="true" />
      <svg className="onboarding-wordmark" width="80" height="37" viewBox="0 6 214 100" role="img" aria-label="nox">
        <g fill="none" stroke="#FFFFFF" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 34 V78 M22 54 A20 20 0 0 1 62 54 V78" />
          <path d="M152 34 L192 78 M192 34 L152 78" />
        </g>
        <circle cx="110" cy="56" r="28.5" fill="#4D78FF" />
      </svg>
      <div className="onboarding-welcome-copy">
        <h1>Seu dinheiro, com clareza.</h1>
        <p>Gastos, ganhos e metas num só lugar. Simples de usar todo dia.</p>
        <button className="onboarding-primary onboarding-welcome-button" onClick={() => goTo(0)}>Começar</button>
        <p className="onboarding-time-note">Leva menos de 1 minuto.</p>
      </div>
    </section>
  );

  if (step >= 0 && step <= 3) {
    const title = ['Como podemos te chamar?', 'Quanto você ganha por mês?', 'Quanto quer guardar por mês?', 'Quanto tem na sua conta hoje?'][step];
    const help = step === 0
      ? 'Só pra deixar o app com a sua cara.'
      : step === 1
        ? variableIncome ? 'Use a média dos últimos meses.' : 'Um valor aproximado já ajuda. Some salário, freelas e outras rendas.'
        : step === 2
          ? `Sugestões com base na sua renda de ${incomeLabel}.`
          : 'É o seu ponto de partida. Dá pra ajustar depois.';
    const advance = () => {
      if (isValid) goTo(step + 1);
    };
    return (
      <section className={`onboard onboarding-stage onboarding-${direction}`} key={`onboarding-${step}-${direction}`}>
        <div className="onboarding-scroll">
          <header className="onboarding-top">
            <button className="onboarding-back" type="button" aria-label="Voltar" onClick={() => goTo(step - 1)}>
              <Icon name="arrowLeft" size={22} />
            </button>
            <div className="onboarding-progress" role="progressbar" aria-label="Progresso do primeiro acesso" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}>
              {Array.from({ length: 4 }, (_, index) => <i key={index} className={index <= step ? 'on' : ''} aria-hidden="true" />)}
            </div>
            <span className="onboarding-step-count">{step + 1} de 4</span>
          </header>
          <form
            className="onboarding-form"
            onSubmit={(event) => { event.preventDefault(); advance(); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                event.preventDefault();
                advance();
              }
            }}
          >
            <h1>{title}</h1>
            <p className="onboarding-help">{help}</p>
            {step === 0 && (
              <input
                ref={inputRef}
                className="onboarding-name-input"
                aria-label="Seu nome"
                autoComplete="given-name"
                autoCapitalize="words"
                maxLength={30}
                placeholder="Seu nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
            {step === 1 && (
              <>
                <OnboardingMoneyField inputRef={inputRef} label="Renda mensal em reais" value={income} onChange={setIncome} />
                <div className="onboarding-variable-row">
                  <span>Minha renda muda de um mês pro outro</span>
                  <button
                    className={`onboarding-switch ${variableIncome ? 'on' : ''}`}
                    type="button"
                    role="switch"
                    aria-label="Minha renda muda de um mês pro outro"
                    aria-checked={variableIncome}
                    onClick={() => setVariableIncome((value) => !value)}
                  ><i /></button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <OnboardingMoneyField inputRef={inputRef} label="Quanto guardar por mês em reais" value={savings} onChange={setSavings} />
                {savingsTooHigh && <p className="onboarding-error" role="alert">Precisa ser menor que a sua renda.</p>}
                <div className="onboarding-suggestions">
                  {suggestions.map(({ rate, amount }) => (
                    <button
                      key={rate}
                      className={`onboarding-suggestion ${selectedSuggestion === rate ? 'selected' : ''}`}
                      type="button"
                      aria-pressed={selectedSuggestion === rate}
                      onClick={() => setSavings(amount)}
                    >
                      <strong>{rate}%</strong>
                      <span>{money(amount)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <OnboardingMoneyField
                  inputRef={inputRef}
                  label="Saldo atual em reais"
                  value={balance}
                  onChange={setBalance}
                  emptyAsZero
                  onEmptyChange={(empty) => setBalanceEntered(!empty)}
                />
                <p className="onboarding-balance-note">Conta principal, onde cai o seu salário.</p>
              </>
            )}
          </form>
        </div>
        <button className="onboarding-primary onboarding-fixed-button" type="button" disabled={!isValid} onClick={advance}>
          {step === 3 ? 'Concluir' : 'Continuar'}
        </button>
      </section>
    );
  }

  return (
    <section className={`onboard onboarding-stage onboarding-ready onboarding-${direction}`} key={`onboarding-${step}-${direction}`}>
      <div className="onboarding-scroll onboarding-ready-scroll">
        <div className="onboarding-ready-mark" aria-hidden="true" />
        <h1>Tudo pronto, {cleanedName}.</h1>
        <p className="onboarding-ready-help">Montamos seu mês com o que você contou.</p>
        <div className="onboarding-summary">
          <p>Livre para gastar por mês</p>
          <strong className="onboarding-free-value">{money(income - savings)}</strong>
          <div className="onboarding-summary-line" />
          <div className="onboarding-summary-row"><span>Renda mensal</span><strong>{money(income)}</strong></div>
          <div className="onboarding-summary-row"><span>Guardar por mês</span><strong>{money(savings)} · {savingsPercent}%</strong></div>
          <div className="onboarding-summary-row"><span>Saldo inicial</span><strong>{money(balance)}</strong></div>
        </div>
      </div>
      <div className="onboarding-privacy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <span>Seus dados ficam salvos só neste aparelho.</span>
      </div>
      <button className="onboarding-primary onboarding-fixed-button" type="button" onClick={finish}>Ir para o início</button>
    </section>
  );
}

function OnboardingMoneyField({
  inputRef,
  label,
  value,
  onChange,
  emptyAsZero = false,
  onEmptyChange,
}: {
  inputRef: RefObject<HTMLInputElement>;
  label: string;
  value: number;
  onChange: (value: number) => void;
  emptyAsZero?: boolean;
  onEmptyChange?: (empty: boolean) => void;
}) {
  const [text, setText] = useState(() => formatOnboardingMoney(value) || (emptyAsZero ? '0' : ''));
  const lastValue = useRef(value);

  useEffect(() => {
    if (lastValue.current !== value) {
      setText(formatOnboardingMoney(value));
      lastValue.current = value;
    }
  }, [value]);

  const update = (input: string) => {
    const normalized = input.replace(/[^\d,]/g, '');
    const commaIndex = normalized.indexOf(',');
    const wholeRaw = (commaIndex < 0 ? normalized : normalized.slice(0, commaIndex)).slice(0, 7);
    const fraction = commaIndex < 0 ? '' : normalized.slice(commaIndex + 1).replace(/,/g, '').slice(0, 2);
    const whole = wholeRaw.replace(/^0+(?=\d)/, '');
    const displayWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const nextText = commaIndex < 0 ? displayWhole : `${displayWhole || '0'},${fraction}`;
    const cents = Math.min(999_999_999, (Number(whole || 0) * 100) + Number(fraction.padEnd(2, '0') || 0));
    setText(nextText);
    lastValue.current = cents;
    onEmptyChange?.(!input.trim());
    onChange(cents);
  };

  return (
    <div className="onboarding-money-field">
      <span aria-hidden="true">R$</span>
      <input
        ref={inputRef}
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={text}
        onChange={(event) => update(event.target.value)}
      />
    </div>
  );
}

function formatOnboardingMoney(value: number) {
  if (!value) return '';
  return (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: value % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

function Settings() {
  const { state, actions } = useStore();
  const settings = state.settings;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(settings.name);
  const [income, setIncome] = useState(settings.monthlyIncome);
  const [savings, setSavings] = useState(settings.monthlySavings);
  const [category, setCategory] = useState<Category | 'new' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const dayStart = settings.dayStart ?? 1;
  const lastBackupDays = settings.lastBackup ? Math.floor((Date.now() - new Date(settings.lastBackup).getTime()) / 864e5) : null;

  const exportBackup = () => {
    downloadFile(`nox-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
    actions.updateSettings({ lastBackup: new Date().toISOString() });
    setMessage('Backup salvo neste aparelho.');
  };
  const restoreBackup = async (file?: File) => {
    if (!file) return;
    try {
      const restored = JSON.parse(await file.text()) as State;
      if (!restored || !restored.settings || typeof restored.onboarded !== 'boolean' || !Array.isArray(restored.accounts) ||
        !Array.isArray(restored.transactions) || !Array.isArray(restored.categories) || !Array.isArray(restored.recurring) ||
        !Array.isArray(restored.budgets) || !Array.isArray(restored.goals)) {
        throw new Error('Esse arquivo não parece ser um backup NOX válido.');
      }
      actions.importState(restored);
      setMessage('Backup restaurado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar este backup.');
    }
  };
  const exportCsv = () => {
    const rows = [['data', 'descrição', 'categoria', 'tipo', 'valor'], ...state.transactions.map((transaction) => [
      transaction.date,
      transaction.description,
      state.categories.find((item) => item.id === transaction.categoryId)?.name ?? '',
      transaction.flow === 'income' ? 'entrada' : 'saída',
      (transaction.amount / 100).toFixed(2).replace('.', ','),
    ])];
    const csv = rows.map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    downloadFile(`nox-lancamentos-${today()}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="screen settings-screen">
      <h1 className="title">Ajustes</h1>
      <section className="settings-profile">
        <div className="profile-avatar">{settings.name.trim().charAt(0).toUpperCase() || 'N'}</div>
        <div className="grow">
          {editing ? <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" /> : <strong>{settings.name || 'Seu perfil'}</strong>}
          <button className="link" onClick={() => {
            if (editing) actions.updateSavingsPlan(savings, { name: name.trim(), monthlyIncome: income });
            setEditing(!editing);
          }}>{editing ? 'Salvar perfil' : 'Editar perfil'}</button>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Seu mês</h2></div>
        <div className="settings-group">
          <label className="settings-row"><span>Renda mensal</span><MoneyInput value={income} onChange={setIncome} /></label>
          <label className="settings-row"><span>Guardar por mês</span><MoneyInput value={savings} onChange={setSavings} /></label>
          <label className="settings-row"><span>Meu mês começa no dia</span><select className="settings-select" value={dayStart} onChange={(event) => actions.updateSettings({ dayStart: Number(event.target.value) })}>{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{String(index + 1).padStart(2, '0')}</option>)}</select></label>
          <button className="settings-save" onClick={() => actions.updateSavingsPlan(savings, { monthlyIncome: income })}>Salvar valores</button>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Preferências</h2></div>
        <div className="settings-group">
          <div className="settings-row"><span>Esconder valores ao abrir</span><Switch label="Esconder valores ao abrir" on={Boolean(settings.hideOnOpen)} onChange={(value) => actions.updateSettings({ hideOnOpen: value })} /></div>
          <div className="settings-row"><span>Lembrete de contas</span><Switch label="Lembrete de contas" on={settings.reminders !== false} onChange={(value) => actions.updateSettings({ reminders: value })} /></div>
          <button className="settings-action" onClick={() => setCategory('new')}>Categorias <Icon name="chevronRight" size={18} /></button>
          {state.categories.map((item) => (
            <button key={item.id} className="settings-subaction" onClick={() => setCategory(item)}>{item.name}<span>{item.hidden ? 'Oculta' : 'Editar'}</span></button>
          ))}
        </div>
        <p className="settings-note">Os avisos de contas aparecem dentro do NOX. Notificações agendadas no celular precisam de um servidor de envio.</p>
      </section>

      <section className="section">
        <div className="section-head"><h2>Seus dados ficam só neste aparelho</h2></div>
        <div className="settings-group">
          <button className="settings-action" onClick={exportBackup}>Fazer backup <span className={lastBackupDays !== null && lastBackupDays > 7 ? 'attention-text' : ''}>{lastBackupDays === null ? 'Nunca' : `Último há ${lastBackupDays} dias`}</span></button>
          <label className="settings-action file-action">Restaurar backup<input type="file" accept="application/json,.json" onChange={(event) => void restoreBackup(event.target.files?.[0])} /></label>
          <button className="settings-action" onClick={exportCsv}>Exportar planilha (.csv)<Icon name="download" size={18} /></button>
          <button className="settings-action destructive-action" onClick={() => setDeleteConfirm(true)}>Apagar todos os dados<Icon name="chevronRight" size={18} /></button>
        </div>
        {message && <p className="settings-note" role="status">{message}</p>}
      </section>

      <footer className="settings-footer">NOX 1.0</footer>

      {category && <CategorySheet category={category === 'new' ? undefined : category} onClose={() => setCategory(null)} />}
      {deleteConfirm && (
        <Sheet title="Apagar todos os dados?" onClose={() => { setDeleteConfirm(false); setConfirmation(''); }}>
          <p className="support-text">Essa ação não pode ser desfeita. Digite APAGAR para confirmar.</p>
          <input className="input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="APAGAR" />
          <div className="btns">
            <button className="btn danger" disabled={confirmation !== 'APAGAR'} onClick={() => { actions.reset(); setDeleteConfirm(false); }}>Apagar todos os dados</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function CategorySheet({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { actions } = useStore();
  const [name, setName] = useState(category?.name ?? '');
  const [flow, setFlow] = useState<Flow>(category?.flow ?? 'expense');
  const [hidden, setHidden] = useState(Boolean(category?.hidden));
  return (
    <Sheet title={category ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
      <label className="field"><span>Nome</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
      {!category && <div className="field"><span>Tipo</span><div className="chips">{(['expense', 'income'] as Flow[]).map((value) => <button key={value} className={`chip ${flow === value ? 'on' : ''}`} onClick={() => setFlow(value)}>{value === 'expense' ? 'Saída' : 'Entrada'}</button>)}</div></div>}
      {category && <div className="settings-row"><span>Ocultar categoria</span><Switch label="Ocultar categoria" on={hidden} onChange={setHidden} /></div>}
      <div className="btns"><button className="btn" disabled={!name.trim()} onClick={() => {
        if (category) actions.updateCategory({ ...category, name: name.trim(), hidden });
        else actions.addCategory({ name: name.trim(), flow, color: '#4D78FF' });
        onClose();
      }}>Salvar categoria</button></div>
    </Sheet>
  );
}

function downloadFile(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
