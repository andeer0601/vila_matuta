'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CustomMealSelection, ShiftName } from '@/types/database';
import { addDateDays, allocated, Capacity, DAILY_CAPACITY, DeliveryPlan, isProductionDate, nextAvailableDate, planCount, todayInSaoPaulo } from '@/lib/scheduling';
import { addSuggestedDelivery, suggestDeliveries } from '@/lib/purchase-draft';

export const shortDate=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'—';
export const deliveryWindow=(date:string)=>date?'Entrega em '+shortDate(date)+' ou '+shortDate(addDateDays(date,1)):'';

export function DeliveryPlanner({items,capacity,plans,onChange,mode,onModeChange,reservedDates=[],paid=false}:{
 items:CustomMealSelection[];capacity:Capacity;plans:DeliveryPlan[];onChange:(plans:DeliveryPlan[])=>void;mode:'single'|'scheduled';onModeChange:(mode:'single'|'scheduled')=>void;reservedDates?:string[];paid?:boolean;
}){
 const {user}=useAuth();const [frequency,setFrequency]=useState(7);const [message,setMessage]=useState('');
 const total=items.reduce((n,i)=>n+i.quantity,0);
 const effectiveCapacity={...capacity,...Object.fromEntries(reservedDates.map(date=>[date,DAILY_CAPACITY]))};
 useEffect(()=>{
  if(!items.length)return;
  if(mode==='single'){
   const quantities=Object.fromEntries(items.map(i=>[i.tempId,i.quantity]));
   const date=plans[0]?.date||nextAvailableDate(undefined,effectiveCapacity,total);
   if(plans.length!==1||plans[0]?.date!==date||JSON.stringify(plans[0]?.quantities)!==JSON.stringify(quantities))onChange([{...plans[0],id:plans[0]?.id||crypto.randomUUID(),date,quantities}]);
  }else if(!plans.length){const suggested=suggestDeliveries(items,effectiveCapacity,frequency);if(suggested.length)onChange(suggested);}
  else {
   const cleaned=plans.map(p=>({...p,quantities:Object.fromEntries(Object.entries(p.quantities).filter(([id])=>items.some(i=>i.tempId===id)))}));
   if(JSON.stringify(cleaned)!==JSON.stringify(plans))onChange(cleaned.filter(p=>planCount(p)>0));
  }
 },[items,mode,plans,capacity,total,frequency]);
 const switchMode=(next:'single'|'scheduled')=>{
  if(mode===next)return;setMessage('');onModeChange(next);
  if(next==='single')onChange([{id:plans[0]?.id||crypto.randomUUID(),date:nextAvailableDate(undefined,effectiveCapacity,total),quantities:Object.fromEntries(items.map(i=>[i.tempId,i.quantity])),period:plans[0]?.period}]);
  else {const initial=suggestDeliveries(items,effectiveCapacity,frequency,plans[0]?.date||undefined);onChange(initial.length===1?addSuggestedDelivery(items,initial,effectiveCapacity,frequency):initial);}
 };
 const update=(id:string,patch:Partial<DeliveryPlan>)=>onChange(plans.map(p=>p.id===id?{...p,...patch}:p));
 return <section className="space-y-5" aria-label="Planejamento das entregas">
  <div className="grid grid-cols-2 gap-3">{([['single','Uma entrega'],['scheduled','Dividir entregas']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} className={'choice p-4 font-semibold '+(mode===value?'selected':'')} onClick={()=>switchMode(value)}>{label}</button>)}</div>
  <p className="text-sm text-stone-600">Produção às segundas, quartas e sextas. Entrega nesse dia ou no seguinte.</p>
  {mode==='scheduled'&&<label className="block text-sm font-semibold">Intervalo das próximas entregas<select className="field mt-2" value={frequency} onChange={e=>setFrequency(Number(e.target.value))}><option value={7}>Uma semana</option><option value={14}>Duas semanas</option></select></label>}
  {mode==='single'&&total>DAILY_CAPACITY&&<p role="alert" className="notice">Acima de 120 marmitas, divida em mais entregas.</p>}
  {plans.map((plan,index)=>{
   const count=planCount(plan);const dateValid=isProductionDate(plan.date)&&!reservedDates.includes(plan.date)&&!plans.some(p=>p.id!==plan.id&&p.date===plan.date)&&(capacity[plan.date]||0)+Math.max(2,count)<=DAILY_CAPACITY;
   const dates=Array.from({length:28},(_,i)=>addDateDays(todayInSaoPaulo(),i+1)).filter(date=>isProductionDate(date)&&!reservedDates.includes(date)&&!plans.some(p=>p.id!==plan.id&&p.date===date)&&(capacity[date]||0)+Math.max(2,count)<=DAILY_CAPACITY).slice(0,6);
   return <article key={plan.id} className="rounded-2xl border border-[#DECAB6] bg-[#FFFCF7] p-4 sm:p-5 space-y-4">
    <div className="flex justify-between items-start gap-3"><div><h3 className="font-bold">Entrega {index+1}</h3><p className="text-sm text-stone-600">{count} marmitas</p></div>{mode==='scheduled'&&plans.length>1&&<button className="text-sm underline text-red-800" onClick={()=>onChange(plans.filter(p=>p.id!==plan.id))} aria-label={'Remover entrega '+(index+1)}>Remover</button>}</div>
    <fieldset><legend className="text-sm font-semibold mb-2">Data da produção</legend><div className="grid grid-cols-3 gap-2">{dates.map(date=><button key={date} className={'choice py-2 px-1 text-sm '+(date===plan.date?'selected':'')} aria-label={'Produção '+date.split('-').reverse().join('/')+' — entrega '+(index+1)} aria-pressed={date===plan.date} onClick={()=>update(plan.id,{date})}><span className="block text-xs">{new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'})}</span><strong>{shortDate(date)}</strong></button>)}</div></fieldset>
    <details><summary className="text-sm underline cursor-pointer py-1">Outra data{plan.date&&!dates.includes(plan.date)?' · '+shortDate(plan.date):''}</summary><label className="block text-sm mt-3">Data da produção {index+1}<input className="field mt-1" type="date" min={addDateDays(todayInSaoPaulo(),1)} value={plan.date} onChange={e=>update(plan.id,{date:e.target.value})}/></label></details>
    {dateValid?<p className="font-semibold text-sm text-[#71421E]">{deliveryWindow(plan.date)}</p>:<p role="alert" className="text-sm text-red-800">Escolha uma produção disponível para esta quantidade.</p>}
    <label className="block text-sm">Preferência de período<select aria-label={'Período da entrega '+(index+1)} className="field mt-1" value={plan.period||''} onChange={e=>update(plan.id,{period:(e.target.value||null) as ShiftName|null})}><option value="">{user?.preferred_delivery_period||'Sem preferência'}</option>{['Manhã','Tarde','Noite'].map(period=><option key={period}>{period}</option>)}</select><span className="text-xs text-stone-600">Horário sujeito à rota.</span></label>
    {mode==='scheduled'&&items.map(item=>{const selected=plan.quantities[item.tempId]||0;const available=item.quantity-allocated(plans.filter(p=>p.id!==plan.id),item.tempId);return <label key={item.tempId} className="flex items-center justify-between gap-3 border-t border-stone-200 pt-3"><span className="text-sm min-w-0">{item.name}</span><select aria-label={'Quantidade de '+item.name+' na entrega '+(index+1)} className="field !w-24 shrink-0" value={selected} onChange={e=>update(plan.id,{quantities:{...plan.quantities,[item.tempId]:Number(e.target.value)}})}>{Array.from({length:Math.min(Math.max(0,available),120)+1},(_,n)=>n).filter(n=>(n===0||n>=2)&&available-n!==1).map(n=><option key={n} value={n}>{n} un</option>)}{(selected>available||selected>120||selected===1)&&<option value={selected} disabled>{selected} — ajustar</option>}</select></label>;})}
   </article>;
  })}
  {mode==='scheduled'&&<><button className="button-secondary w-full" disabled={plans.length>=200} onClick={()=>{const next=addSuggestedDelivery(items,plans,effectiveCapacity,frequency);if(next===plans)setMessage('Para dividir, cada sabor precisa de pelo menos 2 unidades por entrega.');else{onChange(next);setMessage('');}}}>Adicionar entrega</button><p className="text-xs text-stone-600">Mínimo de 2 por sabor em cada entrega. O restante fica para agendar depois.</p></>}
  {message&&<p role="status" className="notice">{message}</p>}
  {paid&&<p className="text-xs text-stone-600">As vagas são reservadas ao salvar.</p>}
 </section>;
}
