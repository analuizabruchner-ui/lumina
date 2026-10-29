import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { daysInMonth, money, monthKey, pad, shiftMonth, today, uid } from '../lib/format';
import type { Flow, Transaction } from '../lib/types';
import { AmountPad, categoryIconName, Money, Switch } from './ui';
import { Icon } from './Icon';

type Payment = NonNullable<Transaction['payment']>;

const paymentOptions: { value: Payment; label: string }[] = [
  { value: 'debit', label: 'Débito' },
  { value: 'pix', label: 'Pix' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'card', label: 'Cartão' },
];

export function TransactionSheet({ initial, onClose, onSaved }: { initial?: Transaction; onClose: () => void; onSaved: (result: { ids: string[]; recurringId?: string; message: string }) => void }) {
  const { state, actions } = useStore();
  const editing = Boolean(initial);
  const [step, setStep] = useState<'amount' | 'details'>(editing ? 'details' : 'amount');
  const [flow, setFlow] = useState<Flow>(initial?.flow ?? 'expense');
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [accountId, setAccountId] = useState(initial?.accountId ?? state.accounts[0]?.id ?? '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [repeat, setRepeat] = useState(false);
  const [payment, setPayment] = useState<Payment>(initial?.payment ?? 'debit');
  const [installments, setInstallments] = useState(initial?.installment?.total ?? 1);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const visibleCategories = state.categories.filter((category) => category.flow === flow && (!category.hidden || category.id === initial?.categoryId));
  const categories = visibleCategories.length ? visibleCategories : state.categories.filter((category) => category.flow === flow);
  const category = categories.find((item) => item.id === categoryId);
  const label = flow === 'income' ? 'entrada' : 'gasto';

  useEffect(() => {
    window.history.pushState({ ...(window.history.state ?? {}), noxTransaction: true, noxTransactionStep: 'amount' }, '', window.location.href);
    const onPop = () => {
      if (!editingRef.current && stepRef.current === 'details') setStep('amount');
      else onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const save = () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const finalCategory = category?.id ?? categories[categories.length - 1]?.id ?? '';
    const finalDescription = description.trim() || category?.name || (flow === 'income' ? 'Entrada' : 'Gasto');
    let recurringId = initial?.recurringId;
    if (repeat && !editing) {
      recurringId = uid();
      actions.saveRecurring({
        id: recurringId,
        name: finalDescription,
        flow,
        amount,
        day: Number(date.slice(8)),
        categoryId: finalCategory,
        accountId,
        subscription: finalCategory === 'c-assinaturas',
        active: true,
      });
    }

    const count = !editing && payment === 'card' && flow === 'expense' ? Math.max(1, installments) : 1;
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const month = shiftMonth(monthKey(date), index);
      const day = Math.min(Number(date.slice(8)), daysInMonth(month));
      const id = initial?.id && index === 0 ? initial.id : uid();
      ids.push(id);
      actions.saveTransaction({
        id,
        flow,
        amount: count > 1 ? Math.floor(amount / count) + (index < amount % count ? 1 : 0) : amount,
        description: initial?.installment ? finalDescription.replace(/ · \d+\/\d+$/, '') : finalDescription,
        categoryId: finalCategory,
        accountId,
        date: `${month}-${pad(day)}`,
        recurringId: index === 0 ? recurringId : undefined,
        payment,
        installment: count > 1 ? { n: index + 1, total: count } : initial?.installment,
      });
    }
    window.history.go(editing ? -1 : -2);
    onSaved({ ids: editing ? [] : ids, recurringId: editing ? undefined : recurringId, message: flow === 'income' ? 'Entrada salva' : 'Gasto salvo' });
  };

  const remove = () => {
    if (initial && confirm('Excluir esta movimentação?')) {
      actions.removeTransaction(initial.id);
      window.history.back();
      onClose();
    }
  };
  const back = () => {
    if (window.history.state?.noxTransaction) window.history.back();
    else onClose();
  };
  const continueToDetails = () => {
    window.history.pushState({ ...(window.history.state ?? {}), noxTransaction: true, noxTransactionStep: 'details' }, '', window.location.href);
    setStep('details');
  };

  return (
    <div className="transaction-fullscreen" role="dialog" aria-modal="true" aria-label="Nova movimentação">
      <header className="transaction-header">
        <button className="icon-btn" onClick={back} aria-label={step === 'details' && !editing ? 'Voltar' : 'Fechar'}>
          <Icon name={step === 'details' && !editing ? 'arrowLeft' : 'close'} size={22} />
        </button>
        {!editing && step === 'amount' && <div className="segmented transaction-flow">
          <button className={flow === 'expense' ? 'on' : ''} onClick={() => { setFlow('expense'); setCategoryId(''); }}>Gasto</button>
          <button className={flow === 'income' ? 'on' : ''} onClick={() => { setFlow('income'); setCategoryId(''); }}>Entrada</button>
        </div>}
        {step === 'details' && <strong className="transaction-value-badge">{flow === 'expense' ? '− ' : '+ '}<Money value={amount} /></strong>}
        {editing && <button className="icon-btn destructive-action" onClick={remove} aria-label="Excluir movimentação"><Icon name="trash" size={20} /></button>}
      </header>

      {step === 'amount' ? (
        <section className="transaction-amount-step">
          <p>{flow === 'income' ? 'Quanto você recebeu?' : 'Quanto você gastou?'}</p>
          <div className="transaction-amount">
            <span>R$</span>
            <strong>{state.settings.hideValues ? '•••••' : money(amount).replace('R$', '').trim()}</strong>
          </div>
          <i className="amount-caret" />
          <div className="transaction-keypad"><AmountPad value={amount} onChange={setAmount} /></div>
          <button className="btn transaction-continue" disabled={amount === 0} onClick={continueToDetails}>Continuar</button>
        </section>
      ) : (
        <section className="transaction-details-step">
          <h1>{flow === 'income' ? 'De onde veio?' : 'Com o que foi?'}</h1>
          <div className="category-grid">
            {categories.map((item) => (
              <button key={item.id} className={`category-tile ${item.id === categoryId ? 'on' : ''}`} onClick={() => setCategoryId(item.id)}>
                <Icon name={categoryIconName(item.name)} size={21} />
                <span>{item.name}</span>
              </button>
            ))}
          </div>

          <div className="transaction-fields">
            <label className="transaction-field">
              <span>Descrição</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" />
            </label>
            <label className="transaction-field">
              <span>Data</span>
              <input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />
            </label>
            <div className="transaction-field vertical-field">
              <span>Pagamento</span>
              <div className="chips">
                {paymentOptions.map((option) => <button key={option.value} className={`chip ${payment === option.value ? 'on' : ''}`} onClick={() => setPayment(option.value)}>{option.label}</button>)}
              </div>
            </div>
            {payment === 'card' && flow === 'expense' && (
              <label className="transaction-field">
                <span>Parcelas</span>
                <select value={installments} onChange={(event) => setInstallments(Math.max(1, Number(event.target.value)))}>{Array.from({ length: 24 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1 === 1 ? 'À vista' : `Em ${index + 1} vezes`}</option>)}</select>
              </label>
            )}
            {state.accounts.length > 1 && <div className="transaction-field vertical-field">
              <span>Conta</span>
              <div className="chips">{state.accounts.map((account) => <button key={account.id} className={`chip ${account.id === accountId ? 'on' : ''}`} onClick={() => setAccountId(account.id)}>{account.name}</button>)}</div>
            </div>}
            {!editing && <div className="transaction-field repeat-field">
              <span>Repetir todo mês</span>
              <Switch label="Repetir lançamento todo mês" on={repeat} onChange={setRepeat} />
            </div>}
          </div>
          <button className="btn transaction-save" disabled={saving || amount === 0 || !categoryId} onClick={save}>
            Salvar {label}
          </button>
        </section>
      )}
    </div>
  );
}
