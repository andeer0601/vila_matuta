'use client';

import { useEffect, useState } from 'react';

import {useAuth} from '@/context/AuthContext';

import { CustomMealSelection, ShiftName } from '@/types/database';

import { addDateDays, allocated, Capacity, DAILY_CAPACITY, DeliveryPlan, isProductionDate, nextAvailableDate, planCount, todayInSaoPaulo } from '@/lib/scheduling';

export function DeliveryPlanner({ items, capacity, plans, onChange, mode, onModeChange, reservedDates = [], paid = false }: {

  reservedDates?: string[]; paid?: boolean; items: CustomMealSelection[]; capacity: Capacity; plans: DeliveryPlan[]; onChange: (p: DeliveryPlan[]) => void;

  mode: 'single' | 'scheduled'; onModeChange: (mode: 'single' | 'scheduled') => void;

}) {

  const {user}=useAuth();

  const [frequency, setFrequency] = useState(7);

  const effectiveCapacity = { ...capacity, ...Object.fromEntries(reservedDates.map(d => [d, DAILY_CAPACITY])) };

  const total = items.reduce((n, i) => n + i.quantity, 0);

  const fresh = (from?: string): DeliveryPlan => ({ id: crypto.randomUUID(), date: nextAvailableDate(from, effectiveCapacity, mode === 'single' ? total : 2), quantities: {} });

  useEffect(() => {

    if (!items.length) return;

    if (mode === 'single') {

      const date = plans[0]?.date && isProductionDate(plans[0].date) && (effectiveCapacity[plans[0].date] || 0) + total <= DAILY_CAPACITY ? plans[0].date : nextAvailableDate(undefined, effectiveCapacity, total);

      const quantities = Object.fromEntries(items.map(i => [i.tempId, i.quantity]));

      if (plans.length !== 1 || plans[0]?.date !== date || JSON.stringify(plans[0]?.quantities) !== JSON.stringify(quantities)) onChange([{ ...plans[0], id: plans[0]?.id || crypto.randomUUID(), date, quantities }]);

    } else if (!plans.length) {

      const first = fresh(); onChange(first.date?[first, fresh(addDateDays(first.date, frequency))]:[first]);

    } else {

      const cleaned = plans.map(p => ({ ...p, quantities: Object.fromEntries(Object.entries(p.quantities).filter(([id]) => items.some(i => i.tempId === id))) }));

      if (JSON.stringify(cleaned) !== JSON.stringify(plans)) onChange(cleaned);

    }

  }, [items, mode, capacity, total, plans, frequency]);

  const switchMode = (next: 'single' | 'scheduled') => { onModeChange(next); onChange([]); };

  const dates = Array.from({ length: 366 }, (_, i) => addDateDays(todayInSaoPaulo(), i + 1)).filter(d => isProductionDate(d));

  return <section className="space-y-5" aria-label="Planejamento das entregas">

    <div className="grid sm:grid-cols-2 gap-3">{([['single','Tudo em uma entrega','Receba o pedido completo de uma só vez.'],['scheduled','Entregas programadas','Sua comida no ritmo da sua rotina.']] as const).map(([value,title,desc]) => <button key={value} type="button" aria-pressed={mode === value} className={'choice p-4 text-left ' + (mode === value ? 'selected' : '')} onClick={() => switchMode(value)}><strong className="block">{title}</strong><span className="text-sm opacity-75">{desc}</span></button>)}</div>

    <p className="text-sm text-stone-600">Produção às segundas, quartas e sextas. Até 120 marmitas por dia. A data escolhida é a produção; a entrega pode ocorrer nesse dia ou no seguinte. {paid ? 'Ao salvar, as entregas são reservadas usando seu saldo pago.' : 'Ao avançar para o pagamento, reservamos suas vagas por 30 minutos.'}</p>

    {mode === 'scheduled' && <label className="block text-sm font-semibold">Frequência sugerida<select className="field mt-2" value={frequency} onChange={e => { const interval = Number(e.target.value); setFrequency(interval); let previous = ''; onChange(plans.map((p,i) => { const date = i === 0 ? p.date : nextAvailableDate(addDateDays(previous, interval), effectiveCapacity, Math.max(2,planCount(p))); previous = date; return { ...p,date }; })); }}><option value={7}>Toda semana</option><option value={14}>A cada duas semanas</option></select></label>}

    {mode === 'single' && total > DAILY_CAPACITY && <p role="alert" className="notice">Este pedido ultrapassa 120 unidades. Escolha entregas programadas.</p>}

    {plans.map((plan, index) => <div key={plan.id} className="rounded-2xl border border-[#DECAB6] bg-white p-4 space-y-4">

      <div className="flex items-center justify-between gap-2"><h3 className="font-bold">Entrega {index + 1}</h3><span className="text-sm">{planCount(plan)} marmitas</span>{mode === 'scheduled' && <button className="text-sm text-red-700 underline" onClick={() => onChange(plans.filter(p => p.id !== plan.id))}>Remover entrega {index + 1}</button>}</div>

      <label className="block text-sm">Data da produção<select aria-label={'Data da produção ' + (index + 1)} className="field mt-1" value={plan.date} onChange={e => onChange(plans.map(p => p.id === plan.id ? {...p,date:e.target.value} : p))}><option value="" disabled>Selecione uma data disponível</option>{dates.map(date => { const free = DAILY_CAPACITY - (capacity[date] || 0); const disabled = reservedDates.includes(date) || free < Math.max(2,planCount(plan)) || plans.some(p => p.id !== plan.id && p.date === date); return <option key={date} value={date} disabled={disabled}>{new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})} · {reservedDates.includes(date) ? 'Já agendada neste pedido' : free === 0 ? 'Produção completa' : free + ' vagas'}</option>; })}</select></label>

      <label className="block text-sm">Melhor período para receber<select className="field mt-1" value={plan.period||''} onChange={e=>onChange(plans.map(p=>p.id===plan.id?{...p,period:(e.target.value||null) as ShiftName|null}:p))}><option value="">Usar cadastro{user?.preferred_delivery_period?' · '+user.preferred_delivery_period:''}</option>{['Manhã','Tarde','Noite'].map(p=><option key={p}>{p}</option>)}</select><span className="text-xs text-stone-500">Preferência sujeita à organização da rota.</span></label>

      {mode === 'scheduled' && items.map(item => { const selected = plan.quantities[item.tempId] || 0; const available = item.quantity - allocated(plans.filter(p => p.id !== plan.id), item.tempId); return <label key={item.tempId} className="flex gap-4 items-center justify-between border-t border-stone-100 pt-3"><span className="text-sm min-w-0"><strong className="block">{item.name}</strong><span className="text-xs text-stone-500">{[item.side1?.name,item.side2?.name].filter(Boolean).join(' + ')}<br/>{item.quantity - allocated(plans,item.tempId)} ainda sem data</span></span><select aria-label={'Quantidade de '+item.name+' na entrega '+(index+1)} className="field !w-24 shrink-0" value={selected} onChange={e => onChange(plans.map(p => p.id === plan.id ? {...p,quantities:{...p.quantities,[item.tempId]:Number(e.target.value)}} : p))}>{Array.from({length: Math.min(Math.max(0,available),120) + 1},(_,n) => n).filter(n => (n === 0 || n >= 2) && available-n !== 1).map(n => <option key={n} value={n}>{n} un</option>)}{(selected > available || selected > 120 || selected === 1) && <option value={selected} disabled>{selected} · ajustar</option>}</select></label>; })}

    </div>)}

    {mode === 'scheduled' && <><button className="button-secondary w-full" disabled={plans.length >= 200} onClick={() => { const last = plans.map(p => p.date).sort().at(-1); onChange([...plans, fresh(last ? addDateDays(last,frequency) : undefined)]); }}>+ Adicionar entrega</button><p className="text-sm text-stone-600">Mínimo de 2 por sabor em cada entrega. Você pode guardar unidades para agendar depois, desde que sobrem pelo menos 2 de cada combinação.</p></>}

  </section>;

}
