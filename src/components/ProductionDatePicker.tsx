'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {addDateDays,Capacity,CapacityLimits,productionLimit,todayInSaoPaulo} from '@/lib/scheduling';
import {monthDays,monthStart,productionDayStatus,shiftMonth} from '@/lib/production-calendar';

const dayLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});
export function ProductionDatePicker({date,onChange,scheduled,occupied,limits}:{date:string;onChange:(date:string)=>void;scheduled:Capacity;occupied:Capacity;limits:CapacityLimits}){
 const [open,setOpen]=useState(false);const [month,setMonth]=useState(monthStart(date));const [focused,setFocused]=useState(date);const trigger=useRef<HTMLButtonElement>(null);const daysRef=useRef<HTMLDivElement>(null);const moveFocus=useRef(false);const today=todayInSaoPaulo();
 useEffect(()=>{if(moveFocus.current){daysRef.current?.querySelector<HTMLButtonElement>('[data-date="'+focused+'"]')?.focus();moveFocus.current=false;}},[focused,month]);
 function choose(value:string){onChange(value);setMonth(monthStart(value));setFocused(value);}
 function close(){setOpen(false);trigger.current?.focus();}
 function keyboard(e:React.KeyboardEvent,date:string){const offset:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(e.key in offset){e.preventDefault();const next=addDateDays(date,offset[e.key]);moveFocus.current=true;setFocused(next);setMonth(monthStart(next));}else if(e.key==='Escape'){e.preventDefault();close();}}
 const status=productionDayStatus(date,limits,occupied);
 return <section className="rustic-card overflow-hidden" aria-label="Calendário de produção">
  <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
   <div className="w-full sm:w-auto min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-[#995009] mb-2">Data da produção</p><div className="flex items-stretch gap-2">
    <button type="button" className="button-secondary !px-3 shrink-0" aria-label="Dia anterior" onClick={()=>choose(addDateDays(date,-1))}><ChevronLeft size={20}/></button>
    <button ref={trigger} type="button" className="button-secondary !px-3 flex-1 min-w-0 sm:min-w-64" aria-expanded={open} aria-controls="production-month" onClick={()=>{setMonth(monthStart(date));setFocused(date);setOpen(!open);}}><CalendarDays size={18} className="shrink-0"/><span className="text-sm capitalize">{new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})}</span></button>
    <button type="button" className="button-secondary !px-3 shrink-0" aria-label="Próximo dia" onClick={()=>choose(addDateDays(date,1))}><ChevronRight size={20}/></button>
   </div></div>
   <div className="flex items-center gap-4"><button className="text-sm underline py-2" onClick={()=>choose(today)}>Hoje</button><span className={'rounded-full px-3 py-1 text-xs font-semibold '+(status==='Disponível'?'bg-[#F3E7D5] text-[#71421E]':status==='Lotada'?'bg-amber-100 text-amber-900':'bg-stone-100 text-stone-600')}>{date<today&&status==='Disponível'?'Histórico':status}</span></div>
  </div>
  {open&&<div id="production-month" className="border-t border-[#EDE0D4] p-3 sm:p-5 bg-[#FFFCF7]" onKeyDown={e=>{if(e.key==='Escape')close();}}>
   <div className="flex items-center justify-between gap-2 mb-4"><div className="flex items-center gap-1"><button className="button-secondary !p-2" aria-label="Mês anterior" onClick={()=>{const next=shiftMonth(month,-1);setMonth(next);setFocused(next);}}><ChevronLeft size={18}/></button><h2 aria-live="polite" className="font-bold text-base sm:text-xl capitalize min-w-0 text-center px-2">{new Date(month+'T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})}</h2><button className="button-secondary !p-2" aria-label="Próximo mês" onClick={()=>{const next=shiftMonth(month,1);setMonth(next);setFocused(next);}}><ChevronRight size={18}/></button></div><button className="p-2 shrink-0" aria-label="Fechar calendário" onClick={close}><X size={18}/></button></div>
   <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center mb-2 text-xs font-semibold text-stone-600" aria-hidden="true">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=><span key={d}>{d}</span>)}</div>
   <div ref={daysRef} className="grid grid-cols-7 gap-1 sm:gap-2" role="group" aria-label="Dias do mês">
    {monthDays(month).map(day=>{const state=productionDayStatus(day,limits,occupied),unavailable=state==='Bloqueada'||state==='Sem produção',count=scheduled[day]||0,held=Math.max(0,(occupied[day]||0)-count),selected=day===date,other=day.slice(0,7)!==month.slice(0,7);return <button key={day} data-date={day} type="button" tabIndex={day===focused?0:-1} aria-pressed={selected} aria-current={day===today?'date':undefined} aria-label={dayLabel(day)+': '+count+' marmitas programadas, '+held+' reservadas. '+state+(unavailable?'':'. Capacidade '+productionLimit(day,limits))} title={state} onKeyDown={e=>keyboard(e,day)} onClick={()=>choose(day)} className={'min-w-0 min-h-[68px] sm:min-h-[90px] rounded-xl border p-1 sm:p-2 text-center transition '+(selected?'border-[#493021] bg-[#493021] text-white ring-2 ring-[#B08968]':unavailable?'border-stone-200 bg-stone-100 text-stone-500':'border-[#DECAB6] bg-white text-[#493021] hover:bg-[#FFF1D9]')+(other?' opacity-60':'')}>
     <span className={'block text-sm font-semibold '+(day===today?'underline decoration-2 underline-offset-4':'')}>{Number(day.slice(-2))}</span>
     <span className="block mt-1 text-[11px] sm:text-sm font-bold tabular-nums truncate">{count?count+' un':unavailable?'—':'0 un'}</span>
     {held>0?<span className={'block text-[10px] sm:text-xs '+(selected?'text-amber-200':'text-amber-900')}>+{held} <span className="hidden sm:inline">res.</span></span>:state==='Bloqueada'?<span className="block text-[9px] sm:text-xs truncate">Bloq.</span>:null}
    </button>;})}
   </div>
   <p className="text-xs text-stone-600 mt-3">Marmitas programadas · + reservas · — sem produção</p>
  </div>}
  <div className="border-t border-[#EDE0D4] px-4 sm:px-5 py-4 grid grid-cols-3 gap-3" aria-live="polite"><div><strong className="text-xl sm:text-2xl">{scheduled[date]||0}</strong><p className="text-xs text-stone-600">programadas</p></div><div><strong className="text-xl sm:text-2xl">{Math.max(0,(occupied[date]||0)-(scheduled[date]||0))}</strong><p className="text-xs text-stone-600">reservadas</p></div><div><strong className="text-xl sm:text-2xl">{status==='Sem produção'?0:productionLimit(date,limits)}</strong><p className="text-xs text-stone-600">capacidade</p></div></div>
 </section>;
}
