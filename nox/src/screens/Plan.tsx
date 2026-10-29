import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { financialPeriod, monthTotals, pendingFixedBills, transactionsInPeriod } from '../lib/finance';
import { daysBetween, monthKey, monthLabel, parseISO, shortDate, today } from '../lib/format';
import { Icon } from '../components/Icon';
import { Bar, Empty, Money, MoneyInput, Mono, Segmented, Sheet, Switch } from '../components/ui';
import type { Flow, Goal, Recurring } from '../lib/types';

type View = 'budgets' | 'goals' | 'fixed';

export function Plan({ initialView = 'budgets' }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  return (
    <div className="screen planning-screen">
      <h1 className="title">Planejamento</h1>
      <Segmented value={view} onChange={setView} options={[
        { value: 'budgets', label: 'Orçamentos' },
        { value: 'goals', label: 'Metas' },
        { value: 'fixed', label: 'Fixas' },
      ]} />
      <div className="planning-content">
        {view === 'budgets' && <Budgets />}
        {view === 'goals' && <Goals />}
        {view === 'fixed' && <Fixed />}
      </div>
    </div>
  );
}

function Budgets() {
  const { state } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const period = financialPeriod(today(), state.settings.dayStart ?? 1);
  const txs = transactionsInPeriod(state, period);
  const totals = monthTotals(txs);
  const byCategory = totals.byCategory;
  const totalLimit = Math.max(0, state.settings.monthlyIncome - state.settings.monthlySavings);
  const ratio = totalLimit > 0 ? totals.expense / totalLimit : totals.expense > 0 ? Infinity : 0;
  const sortedBudgets = [...state.budgets]
    .map((budget) => ({ budget, spent: byCategory.get(budget.categoryId) ?? 0 }))
    .sort((a, b) => b.spent / b.budget.limit - a.spent / a.budget.limit);
  const free = state.categories.filter((category) => category.flow === 'expense' && !category.hidden && !state.budgets.some((budget) => budget.categoryId === category.id));
  const remaining = Math.max(0, totalLimit - totals.expense);
  const color = ratio > 1 ? 'var(--acima)' : ratio >= 0.9 ? 'var(--atencao)' : 'var(--lua)';

  return (
    <>
      <div className="planning-summary">
        <p>Gasto em {monthLabel(period.month).toLowerCase()}</p>
        <strong className="summary-amount"><Money value={totals.expense} /></strong>
        <div className="summary-sub">de <Money value={totalLimit} /></div>
        <Bar value={totals.expense} max={totalLimit} color={color} />
        <p className="summary-note">{ratio > 1 ? <>Você passou <Money value={totals.expense - totalLimit} /> do planejado</> : <>Sobram <Money value={remaining} /> para os próximos {period.daysLeft} {period.daysLeft === 1 ? 'dia' : 'dias'}</>}</p>
      </div>

      {sortedBudgets.length ? (
        <div className="budget-list">
          {sortedBudgets.map(({ budget, spent }) => {
            const category = state.categories.find((item) => item.id === budget.categoryId);
            const used = budget.limit > 0 ? spent / budget.limit : 0;
            const tone = used > 1 ? 'danger-text' : used >= 0.9 ? 'attention-text' : '';
            return (
              <button key={budget.categoryId} className="budget-row" onClick={() => setEditing(budget.categoryId)}>
                <Mono category={category} size={36} />
                <span className="budget-main">
                  <span className="budget-info"><strong>{category?.name ?? 'Categoria'}</strong><span className={tone}><Money value={spent} /> de <Money value={budget.limit} /></span></span>
                  <Bar value={spent} max={budget.limit} color={used > 1 ? 'var(--acima)' : used >= 0.9 ? 'var(--atencao)' : 'var(--lua)'} />
                  {used > 1 && <span className="budget-over"><Money value={spent - budget.limit} /> acima</span>}
                </span>
              </button>
            );
          })}
        </div>
      ) : <Empty title="Defina limites por categoria" text="Você vê quanto ainda dá pra gastar em cada área e recebe um aviso antes de estourar." />}

      {free.length > 0 && <section className="section">
        <div className="section-head"><h2>Adicionar limite</h2></div>
        <div className="chips">{free.map((category) => <button key={category.id} className="chip" onClick={() => setEditing(category.id)}><Icon name="plus" size={16} /> {category.name}</button>)}</div>
      </section>}
      {editing && <BudgetSheet categoryId={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BudgetSheet({ categoryId, onClose }: { categoryId: string; onClose: () => void }) {
  const { state, actions } = useStore();
  const category = state.categories.find((item) => item.id === categoryId);
  const current = state.budgets.find((budget) => budget.categoryId === categoryId);
  const [limit, setLimit] = useState(current?.limit ?? 0);
  return (
    <Sheet title={category?.name ?? 'Orçamento'} onClose={onClose}>
      <label className="field"><span>Limite por mês</span><MoneyInput value={limit} onChange={setLimit} /></label>
      <div className="btns">
        <button className="btn" disabled={limit <= 0} onClick={() => { actions.setBudget({ categoryId, limit }); onClose(); }}>Salvar limite</button>
        {current && <button className="btn danger" onClick={() => { actions.setBudget({ categoryId, limit: 0 }); onClose(); }}>Remover limite</button>}
      </div>
    </Sheet>
  );
}

function monthsUntil(deadline: string) {
  const target = parseISO(`${deadline.slice(0, 7)}-01`);
  const now = parseISO(`${monthKey(today())}-01`);
  return Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth());
}

function deadlineLabel(deadline: string) {
  const [year, value] = deadline.slice(0, 7).split('-').map(Number);
  const month = new Date(year, value - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${month}/${year}`;
}

function Goals() {
  const { state } = useStore();
  const [open, setOpen] = useState<Goal | 'new' | null>(null);
  const saved = state.goals.reduce((sum, goal) => sum + goal.saved, 0);
  const monthly = state.goals.reduce((sum, goal) => sum + (goal.monthlyContribution ?? 0), 0);
  const period = financialPeriod(today(), state.settings.dayStart ?? 1);
  const savedThisMonth = state.goals.reduce((sum, goal) => sum + (goal.contributions ?? [])
    .filter((contribution) => contribution.date >= period.start && contribution.date <= period.end)
    .reduce((goalSum, contribution) => goalSum + contribution.amount, 0), 0);
  return (
    <>
      <div className="planning-summary goals-summary">
        <p>Guardado nas metas</p>
        <strong className="summary-amount"><Money value={saved} /></strong>
        <p className="summary-note">
          <span className={savedThisMonth >= 0 ? 'income-value' : 'attention-text'}>{savedThisMonth >= 0 ? '+ ' : '− '}<Money value={Math.abs(savedThisMonth)} /></span>
          {' '}este mês, {savedThisMonth >= monthly ? 'dentro do que você planejou' : <>de <Money value={monthly} /> planejados</>}
        </p>
      </div>
      {state.goals.length ? (
        <div className="goal-list">
          {state.goals.map((goal) => {
            const progress = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
            const requiredMonthly = goal.deadline ? Math.ceil(Math.max(0, goal.target - goal.saved) / monthsUntil(goal.deadline)) : 0;
            const contribution = goal.monthlyContribution ?? 0;
            const behind = Boolean(goal.deadline && contribution < requiredMonthly);
            return (
              <button key={goal.id} className="goal-card" onClick={() => setOpen(goal)}>
                <span className="goal-heading"><strong>{goal.name}</strong><span>{progress}%</span></span>
                <span className="goal-values"><Money value={goal.saved} /> de <Money value={goal.target} /></span>
                <Bar value={goal.saved} max={goal.target} color="var(--lua)" />
                <span className={`goal-note ${behind ? 'attention-text' : ''}`}>
                  {!goal.deadline ? <>Sem prazo · guardando <Money value={contribution} /> por mês</> :
                    behind ? <>Guardando <Money value={contribution} /> · precisa de <Money value={requiredMonthly} /> por mês até {deadlineLabel(goal.deadline)}</> :
                      <>Até {deadlineLabel(goal.deadline)} · guardando <Money value={contribution} /> por mês</>}
                </span>
              </button>
            );
          })}
        </div>
      ) : <Empty title="Crie sua primeira meta" text="Defina o que você quer conquistar e o NOX calcula quanto guardar para chegar lá." />}
      <div className="btns"><button className="btn secondary" onClick={() => setOpen('new')}><Icon name="plus" size={18} /> Nova meta</button></div>
      {open && <GoalSheet goal={open === 'new' ? undefined : open} onClose={() => setOpen(null)} />}
    </>
  );
}

function GoalSheet({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { state, actions } = useStore();
  const [mode, setMode] = useState<'move' | 'edit'>(goal ? 'move' : 'edit');
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal?.target ?? 0);
  const [saved, setSaved] = useState(goal?.saved ?? 0);
  const [deadline, setDeadline] = useState(goal?.deadline?.slice(0, 7) ?? '');
  const otherMonthly = state.goals.filter((item) => item.id !== goal?.id).reduce((sum, item) => sum + (item.monthlyContribution ?? 0), 0);
  const [monthlyContribution, setMonthlyContribution] = useState(goal?.monthlyContribution ?? Math.max(0, state.settings.monthlySavings - otherMonthly));
  const [amount, setAmount] = useState(0);

  if (goal && mode === 'move') return (
    <Sheet title={goal.name} onClose={onClose} action={<button className="icon-btn" onClick={() => setMode('edit')} aria-label="Editar meta"><Icon name="edit" size={20} /></button>}>
      <div className="amount-display"><div className="faint">Guardado</div><div className="v num"><Money value={goal.saved} /></div><div className="faint">de <Money value={goal.target} /></div></div>
      <label className="field"><span>Valor</span><MoneyInput value={amount} onChange={setAmount} /></label>
      <div className="btns two">
        <button className="btn secondary" disabled={amount <= 0 || amount > goal.saved} onClick={() => { actions.contributeGoal(goal.id, -amount); onClose(); }}>Retirar</button>
        <button className="btn" disabled={amount <= 0} onClick={() => { actions.contributeGoal(goal.id, amount); onClose(); }}>Guardar agora</button>
      </div>
    </Sheet>
  );
  return (
    <Sheet title={goal ? 'Editar meta' : 'Nova meta'} onClose={onClose}>
      <label className="field"><span>Nome</span><input className="input" placeholder="Ex.: Viagem" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field"><span>Valor alvo</span><MoneyInput value={target} onChange={setTarget} /></label>
      <label className="field"><span>Já guardado</span><MoneyInput value={saved} onChange={setSaved} /></label>
      <label className="field"><span>Prazo (opcional)</span><input className="input" type="month" min={monthKey(today())} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
      <label className="field"><span>Quanto guardar por mês</span><MoneyInput value={monthlyContribution} onChange={setMonthlyContribution} /></label>
      <p className="settings-note">O total mensal das metas será atualizado para <Money value={otherMonthly + monthlyContribution} />.</p>
      <div className="btns"><button className="btn" disabled={!name.trim() || target <= 0} onClick={() => {
        actions.saveGoal({ id: goal?.id, name: name.trim(), target, saved, deadline: deadline ? `${deadline}-01` : undefined, color: goal?.color ?? '#4D78FF', monthlyContribution });
        actions.updateSettings({ monthlySavings: otherMonthly + monthlyContribution });
        onClose();
      }}>{goal ? 'Salvar meta' : 'Criar meta'}</button>
      {goal && <button className="btn danger" onClick={() => {
        if (confirm('Excluir esta meta?')) {
          actions.removeGoal(goal.id);
          actions.updateSettings({ monthlySavings: otherMonthly });
          onClose();
        }
      }}>Excluir meta</button>}</div>
    </Sheet>
  );
}

function Fixed() {
  const { state, actions } = useStore();
  const [open, setOpen] = useState<Recurring | 'new' | null>(null);
  const period = financialPeriod(today(), state.settings.dayStart ?? 1);
  const periodTransactions = transactionsInPeriod(state, period);
  const pending = pendingFixedBills(state, period);
  const activeBills = state.recurring.filter((item) => item.active && item.flow === 'expense');
  const fixedTotal = activeBills.reduce((sum, item) => sum + item.amount, 0);
  const settledIds = new Set(periodTransactions.filter((tx) => tx.recurringId).map((tx) => tx.recurringId));
  const paidCount = activeBills.filter((item) => settledIds.has(item.id)).length;
  const pendingAmount = pending.filter((item) => item.recurring.flow === 'expense').reduce((sum, item) => sum + item.recurring.amount, 0);
  const pendingById = new Map(pending.map((item) => [item.recurring.id, item]));
  const sorted = [...state.recurring].sort((a, b) => Number(b.active) - Number(a.active) || a.day - b.day);

  return (
    <>
      <div className="planning-summary fixed-summary">
        <p>Contas fixas por mês</p>
        <strong className="summary-amount"><Money value={fixedTotal} /></strong>
        <p className="summary-note">{paidCount} de {activeBills.length} pagas em {monthLabel(period.month).toLowerCase()} · falta <Money value={pendingAmount} /></p>
      </div>
      {sorted.length ? <div className="fixed-list">
        {sorted.map((item) => {
          const paidTx = periodTransactions.find((tx) => tx.recurringId === item.id);
          const pendingItem = pendingById.get(item.id);
          const due = pendingItem?.due ?? paidTx?.date ?? period.start;
          const days = daysBetween(today(), due);
          const checked = Boolean(paidTx);
          return (
            <div className={`fixed-row ${checked ? 'paid' : ''}`} key={item.id}>
              <button className={`paid-toggle ${checked ? 'checked' : ''}`} aria-label={checked ? `Desmarcar ${item.name} como paga` : `Marcar ${item.name} como paga`} onClick={() => {
                if (paidTx) actions.unsettleRecurring(item.id, paidTx.date.slice(0, 7));
                else actions.settleRecurring(item, today());
              }}>{checked && <Icon name="check" size={16} />}</button>
              <button className="fixed-row-main" onClick={() => setOpen(item)}>
                <strong>{item.name}</strong>
                <span className={!checked && days <= 3 ? (days < 0 ? 'danger-text' : 'attention-text') : ''}>
                  Dia {String(item.day).padStart(2, '0')} · {checked ? 'pago' : item.automaticDebit ? 'débito automático' : days < 0 ? `Venceu há ${Math.abs(days)} dias` : days === 0 ? 'Vence hoje' : `Vence em ${days} dias · ${shortDate(due)}`}
                </span>
              </button>
              <button className="fixed-amount" onClick={() => setOpen(item)}><Money value={item.flow === 'income' ? item.amount : -item.amount} className={item.flow === 'income' ? 'pos' : ''} /></button>
            </div>
          );
        })}
      </div> : <Empty title="Cadastre suas contas fixas" text="Aluguel, internet, assinaturas. Marque cada conta como paga para atualizar o extrato." />}

      <div className="settings-group fixed-reminders">
        <div className="settings-row"><div><strong>Me avisar 1 dia antes</strong><small>Notificação no celular</small></div><Switch label="Me avisar um dia antes" on={state.settings.reminders !== false} onChange={(value) => actions.updateSettings({ reminders: value })} /></div>
        {state.settings.reminders !== false && <p className="settings-note">Por enquanto, os avisos aparecem dentro do NOX. Notificações agendadas precisam de um servidor de envio.</p>}
      </div>
      <div className="btns"><button className="btn secondary" onClick={() => setOpen('new')}><Icon name="plus" size={18} /> Adicionar conta fixa</button></div>
      {open && <RecurringSheet item={open === 'new' ? undefined : open} onClose={() => setOpen(null)} />}
    </>
  );
}

function RecurringSheet({ item, onClose }: { item?: Recurring; onClose: () => void }) {
  const { state, actions } = useStore();
  const [flow, setFlow] = useState<Flow>(item?.flow ?? 'expense');
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item?.amount ?? 0);
  const [day, setDay] = useState(item?.day ?? Number(today().slice(8)));
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [subscription, setSubscription] = useState(item?.subscription ?? false);
  const [automaticDebit, setAutomaticDebit] = useState(item?.automaticDebit ?? false);
  const [active, setActive] = useState(item?.active ?? true);
  const visibleCategories = state.categories.filter((category) => category.flow === flow && !category.hidden);
  const categories = visibleCategories.length ? visibleCategories : state.categories.filter((category) => category.flow === flow);
  return (
    <Sheet title={item ? 'Editar conta fixa' : 'Adicionar conta fixa'} onClose={onClose}>
      <Segmented value={flow} onChange={(value) => { setFlow(value); setCategoryId(''); }} options={[
        { value: 'expense', label: 'Saída' }, { value: 'income', label: 'Entrada' },
      ]} />
      <label className="field"><span>Nome</span><input className="input" placeholder="Ex.: Aluguel" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <div className="grid-2">
        <label className="field"><span>Valor</span><MoneyInput value={amount} onChange={setAmount} /></label>
        <label className="field"><span>Dia do vencimento</span><select className="input" value={day} onChange={(event) => setDay(Number(event.target.value))}>{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>Dia {index + 1}</option>)}</select></label>
      </div>
      <div className="field"><span>Categoria</span><div className="chips">{categories.map((category) => <button key={category.id} className={`chip ${category.id === categoryId ? 'on' : ''}`} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}</div></div>
      {flow === 'expense' && <>
        <div className="settings-row"><span>Débito automático</span><Switch label="Débito automático" on={automaticDebit} onChange={setAutomaticDebit} /></div>
        <div className="settings-row"><span>É uma assinatura</span><Switch label="É uma assinatura" on={subscription} onChange={setSubscription} /></div>
      </>}
      <div className="settings-row"><span>Conta ativa</span><Switch label="Conta ativa" on={active} onChange={setActive} /></div>
      <div className="btns">
        <button className="btn" disabled={!name.trim() || amount <= 0 || (categories.length > 0 && !categoryId)} onClick={() => {
          actions.saveRecurring({
            id: item?.id, name: name.trim(), flow, amount, day,
            categoryId: categoryId || categories[0]?.id || '',
            accountId: item?.accountId ?? state.accounts[0].id,
            subscription: flow === 'expense' && subscription, active,
            automaticDebit,
          });
          onClose();
        }}>Salvar conta</button>
        {item && <button className="btn danger" onClick={() => {
          if (confirm('Excluir esta conta fixa? Os lançamentos feitos continuam no extrato.')) { actions.removeRecurring(item.id); onClose(); }
        }}>Excluir conta</button>}
      </div>
    </Sheet>
  );
}
