'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChefHat, Plus, Trash2 } from 'lucide-react';
import { INITIAL_INGREDIENTS } from '@/lib/supabase/mock-data';
import { Ingredient } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { emptyEditor } from '@/lib/purchase-draft';
import { allocated, money, planCount, validatePlan } from '@/lib/scheduling';
import { DeliveryPlanner, deliveryWindow, shortDate } from '@/components/DeliveryPlanner';
import { AddressBook } from '@/components/AddressBook';
import { DEMO_MODE } from '@/lib/mode';

export default function Builder(){
 const router=useRouter();const {user}=useAuth();
 const {draft,draftReady,draftConflict,resolveDraft,patchDraft,items,addItem,editItem,removeItem,updateItemQuantity,createOrder,capacity,totalMealsCount,pricing,isLoading,loadError,refresh}=useCart();
 const {editor,plans,mode,step}=draft;const {type:tab,base,protein,sides,dish,quantity,notes,id:editingItem}=editor;
 const [group,setGroup]=useState<'base'|'protein'|'side'>('base');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const [editingAddress,setEditingAddress]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null);const lastStep=useRef<number|undefined>(undefined);
 const setEditor=(change:Partial<typeof editor>)=>patchDraft({editor:{...editor,...change}});
 useEffect(()=>{if(!draftReady)return;if(lastStep.current!==undefined&&lastStep.current!==step){heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'auto'});}lastStep.current=step;},[step,draftReady]);
 const go=(next:1|2|3)=>{setError('');setNotice('');patchDraft({step:next});};
 const valid=tab==='complete_dish'?!!dish:!!base&&!!protein&&sides.length===2;
 const planError=items.length?validatePlan(items,plans,capacity,mode==='single'):'Adicione pelo menos um sabor.';
 const remaining=items.reduce((n,i)=>n+i.quantity-allocated(plans,i.tempId),0);
 function saveMeal(){
  if(!valid||!Number.isInteger(quantity)||quantity<2){setError('Escolha o sabor e pelo menos 2 unidades.');return;}
  if(totalMealsCount+quantity-(items.find(i=>i.tempId===editingItem)?.quantity||0)>10000){setError('O limite é de 10.000 marmitas por pedido.');return;}
  const item={type:tab,name:tab==='custom'?protein!.name+' com '+base!.name:dish!.name,base:tab==='custom'?base:undefined,protein:tab==='custom'?protein:undefined,side1:tab==='custom'?sides[0]:undefined,side2:tab==='custom'?sides[1]:undefined,completeDish:tab==='complete_dish'?dish:undefined,quantity,specialInstructions:notes.trim()};
  if(editingItem)editItem(editingItem,item);else addItem(item);
  patchDraft({editor:{...emptyEditor(),type:tab}});setGroup('base');setError('');setNotice(editingItem?'Combinação atualizada.':quantity+' marmitas adicionadas.');
 }
 function startEdit(id:string){const item=items.find(i=>i.tempId===id);if(!item)return;patchDraft({step:1,editor:{id,type:item.type,base:item.base,protein:item.protein,sides:[item.side1,item.side2].filter(Boolean) as Ingredient[],dish:item.completeDish,quantity:item.quantity,notes:item.specialInstructions||''}});setGroup('base');setNotice('');document.getElementById('sabores')?.scrollIntoView({block:'start'});}
 async function checkout(){
  setError('');if(planError){setError(planError);return;}
  if(!user){router.push('/entrar?next=/monte-sua-marmita');return;}
  if(!user.onboarding_completed){router.push('/onboarding');return;}
  setBusy(true);try{const order=await createOrder({deliveries:plans});router.push('/checkout/'+order.id);}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar. Tente novamente.');setBusy(false);}
 }
 const catalog=(category:Ingredient['category'],selected:Ingredient[],choose:(i:Ingredient)=>void)=><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{INITIAL_INGREDIENTS.filter(i=>i.category===category&&i.is_available).map(i=><button key={i.id} className={'choice min-h-12 px-4 py-3 text-left text-sm flex justify-between items-center gap-3 '+(selected.some(s=>s.id===i.id)?'selected':'')} aria-pressed={selected.some(s=>s.id===i.id)} onClick={()=>choose(i)}><span>{i.name}</span>{selected.some(s=>s.id===i.id)&&<Check size={18} className="shrink-0"/>}</button>)}</div>;
 if(!draftReady)return <p role="status" className="p-10">Carregando seu pedido…</p>;
 if(draftConflict)return <section className="max-w-xl mx-auto p-6 my-10 rustic-card space-y-5"><h1 className="text-3xl font-bold">Qual pedido quer continuar?</h1><p>Você já tem um rascunho neste perfil.</p><button className="button-primary w-full" onClick={()=>resolveDraft('guest')}>Continuar o pedido que comecei agora</button><button className="button-secondary w-full" onClick={()=>resolveDraft('saved')}>Retomar o rascunho do perfil</button></section>;
 return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 pb-32 lg:pb-12">
  <header className="mb-7"><span className="eyebrow">DO SEU JEITO</span><h1 ref={heading} tabIndex={-1} className="text-3xl sm:text-4xl font-bold mt-2 scroll-mt-40">{step===1?'O que vai na sua semana?':step===2?'Quando quer receber?':'Tudo do seu jeito?'}</h1></header>
  <nav aria-label="Etapas do pedido" className="grid grid-cols-3 gap-2 mb-7">{(['Sabores','Entregas','Revisão'] as const).map((label,index)=>{const number=(index+1) as 1|2|3;return <button key={label} aria-current={step===number?'step':undefined} disabled={busy||!!editingItem&&number!==1||number>1&&!items.length||number===3&&!!planError} onClick={()=>go(number)} className={'rounded-xl py-3 px-2 flex items-center justify-center gap-2 text-sm font-semibold border '+(step===number?'bg-[#493021] text-white border-[#493021]':'bg-white text-[#624128] border-[#DECAB6] disabled:opacity-45')}><span className="hidden sm:inline">{number<step?<Check size={16}/>:('0'+number)}</span>{label}</button>;})}</nav>
  <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start"><div className="space-y-5 min-w-0">
   {step===1&&<section id="sabores" className="rustic-card p-5 sm:p-7 space-y-5 scroll-mt-40"><div><h2 className="text-2xl font-bold">{editingItem?'Editar combinação':'Escolha um sabor'}</h2><p className="text-sm text-stone-600 mt-1">A partir de 2 unidades por sabor.</p></div>
    <div className="grid grid-cols-2 gap-2"><button aria-pressed={tab==='complete_dish'} className={'choice px-3 py-3 font-semibold text-sm '+(tab==='complete_dish'?'selected':'')} onClick={()=>setEditor({type:'complete_dish'})}>Pratos completos</button><button aria-pressed={tab==='custom'} className={'choice px-3 py-3 font-semibold text-sm '+(tab==='custom'?'selected':'')} onClick={()=>setEditor({type:'custom'})}>Montar combinação</button></div>
    {tab==='complete_dish'?catalog('complete_dish',dish?[dish]:[],i=>setEditor({dish:i})):<div className="space-y-3">{([{key:'base',title:'Base · 150 g',value:base?.name},{key:'protein',title:'Proteína · 100 g',value:protein?.name},{key:'side',title:'2 acompanhamentos',value:sides.map(i=>i.name).join(' + ')}] as const).map(section=><section key={section.key} className="border border-[#DECAB6] rounded-xl overflow-hidden"><h3><button className="w-full p-4 text-left flex justify-between gap-3" aria-expanded={group===section.key} aria-controls={'choices-'+section.key} onClick={()=>setGroup(section.key)}><span><strong className="block">{section.title}</strong>{section.value&&<span className="block text-sm text-stone-600 mt-1">{section.value}</span>}</span><span aria-hidden="true">{group===section.key?'−':'+'}</span></button></h3>{group===section.key&&<div id={'choices-'+section.key} className="px-3 pb-3">{section.key==='base'?catalog('base',base?[base]:[],i=>{setEditor({base:i});setGroup('protein');}):section.key==='protein'?catalog('protein',protein?[protein]:[],i=>{setEditor({protein:i});setGroup('side');}):catalog('side',sides,i=>{if(!sides.some(s=>s.id===i.id)&&sides.length===2){setNotice('Desmarque um acompanhamento para trocar.');return;}setEditor({sides:sides.some(s=>s.id===i.id)?sides.filter(s=>s.id!==i.id):[...sides,i]});})}</div>}</section>)}</div>}
    <details open={notes?true:undefined}><summary className="cursor-pointer underline text-sm py-1">Algum cuidado com este sabor?</summary><label className="block mt-3 text-sm">Observação<input className="field mt-1" maxLength={500} value={notes} onChange={e=>setEditor({notes:e.target.value})} placeholder="Ex.: sem coentro"/></label></details>
    <div className="flex flex-col sm:flex-row gap-3 sm:items-end"><label className="text-sm font-semibold sm:w-32">Unidades<input className="field mt-1" aria-label="Unidades deste sabor" type="number" min={2} max={10000} value={quantity||''} onChange={e=>setEditor({quantity:Number(e.target.value)})}/></label><button className="button-primary flex-1" disabled={!valid||quantity<2||!Number.isInteger(quantity)} onClick={saveMeal}>{editingItem?<Check size={18}/>:<Plus size={18}/>} {editingItem?'Salvar combinação':'Adicionar ao pedido'}</button></div>
    {editingItem&&<button className="underline text-sm" onClick={()=>patchDraft({editor:emptyEditor()})}>Cancelar edição</button>}
    {notice&&<p role="status" className="text-sm font-semibold text-[#71421E] flex items-start gap-2"><CheckCircle2 size={18} className="shrink-0"/>{notice}</p>}
   </section>}
   {step===2&&<section className="rustic-card p-5 sm:p-7"><DeliveryPlanner items={items} capacity={capacity} plans={plans} onChange={plans=>patchDraft({plans})} mode={mode} onModeChange={mode=>patchDraft({mode})}/></section>}
   {step===3&&<>
    <section className="rustic-card p-5 sm:p-7 space-y-4"><div className="flex justify-between gap-3 items-center"><h2 className="text-xl font-bold">Seus sabores</h2><button className="underline text-sm min-h-11" onClick={()=>go(1)}>Editar sabores</button></div>{items.map(i=><div key={i.tempId} className="border-t border-stone-100 pt-3"><strong>{i.quantity} × {i.name}</strong><p className="text-sm text-stone-600">{[i.side1?.name,i.side2?.name].filter(Boolean).join(' + ')}</p>{i.specialInstructions&&<p className="text-sm mt-1">{i.specialInstructions}</p>}</div>)}</section>
    <section className="rustic-card p-5 sm:p-7 space-y-4"><div className="flex justify-between items-center gap-3"><h2 className="text-xl font-bold">Suas entregas</h2><button className="underline text-sm min-h-11" onClick={()=>go(2)}>Editar entregas</button></div>{plans.map((p,index)=><div key={p.id} className="rounded-xl bg-[#FAF3E7] p-4 space-y-1"><strong className="block">{deliveryWindow(p.date)}</strong><p className="text-sm text-stone-600">Produção {shortDate(p.date)} · {p.period||user?.preferred_delivery_period||'Sem preferência de período'}</p>{items.filter(i=>p.quantities[i.tempId]).map(i=><p key={i.tempId} className="text-sm">{p.quantities[i.tempId]} × {i.name}</p>)}</div>)}{remaining>0&&<p className="text-sm font-semibold">{remaining} marmitas para agendar depois.</p>}</section>
    <section className="rustic-card p-5 sm:p-7 space-y-4"><div className="flex justify-between items-center gap-3"><h2 className="text-xl font-bold">Endereço e cuidados</h2>{user&&<button className="underline text-sm min-h-11" onClick={()=>setEditingAddress(v=>!v)}>{editingAddress?'Fechar edição':'Editar endereço'}</button>}</div>
     {!user?<><p className="text-sm text-stone-600">Entre para escolher o endereço.</p><Link className="button-secondary" href="/entrar?next=/monte-sua-marmita">Escolher perfil</Link></>:<>{editingAddress?<AddressBook compact onSaved={()=>setEditingAddress(false)}/>:<div className="text-sm space-y-1"><strong>{user.full_name}</strong><p>{user.street}, {user.number}{user.complement?' · '+user.complement:''}</p><p>{user.neighborhood} · {user.city}/{user.state}</p><p>{user.cep} · {user.phone}</p></div>}<div className="border-t pt-3 text-sm"><div className="flex justify-between gap-3"><strong>Restrições alimentares</strong><Link className="underline" href="/onboarding">Editar perfil</Link></div><p className="mt-2">{user.dietary_restrictions?.join(', ')||'Nenhuma informada.'}</p>{user.dietary_notes&&<p className="mt-1">{user.dietary_notes}</p>}</div></>}
    </section>
   </>}
   {step>1&&<button className="button-secondary" onClick={()=>go((step-1) as 1|2)}><ArrowLeft size={17}/>Voltar</button>}
  </div>
  <aside id="carrinho" className="rustic-card p-5 lg:sticky lg:top-36 space-y-4 scroll-mt-40"><div className="flex justify-between items-center"><h2 className="text-xl font-bold">Seu pedido</h2><ChefHat size={23} className="text-[#B94B0B]"/></div>
   <p className="text-sm text-stone-600" aria-live="polite">{totalMealsCount} marmitas{totalMealsCount>0?' · '+money(pricing.unitPrice)+'/un':''}</p>
   {!items.length&&<p className="text-sm py-3 text-stone-600">Escolha seu primeiro sabor.</p>}
   {step===1&&items.map(i=><div key={i.tempId} className="border-t pt-3 space-y-2"><div className="flex justify-between items-start gap-2"><strong className="text-sm">{i.name}</strong><button className="min-w-11 min-h-11 -mt-2 -mr-2 flex items-center justify-center text-red-800" aria-label={'Remover '+i.name} onClick={()=>{removeItem(i.tempId);if(editingItem===i.tempId)patchDraft({editor:emptyEditor()});}}><Trash2 size={17}/></button></div><p className="text-xs text-stone-600">{[i.side1?.name,i.side2?.name].filter(Boolean).join(' + ')}</p><div className="flex items-center justify-between gap-2"><button className="underline text-sm min-h-11" onClick={()=>startEdit(i.tempId)}>Editar combinação</button><div className="flex items-center gap-2"><button className="choice min-w-11 min-h-11" aria-label={'Diminuir '+i.name} disabled={i.quantity<=2||!!editingItem} onClick={()=>updateItemQuantity(i.tempId,-1)}>−</button><span className="text-sm">{i.quantity}</span><button className="choice min-w-11 min-h-11" aria-label={'Aumentar '+i.name} disabled={totalMealsCount>=10000||!!editingItem} onClick={()=>updateItemQuantity(i.tempId,1)}>+</button></div></div></div>)}
   {step>1&&<div className="text-sm space-y-2"><p>{plans.filter(p=>planCount(p)>0).length} entrega(s) planejada(s)</p>{remaining>0&&<p>{remaining} marmitas para depois</p>}</div>}
   <div className="border-t pt-4"><div className="flex justify-between gap-2 items-center"><span className="text-sm">Refeições</span><strong className="text-2xl">{money(pricing.totalPrice)}</strong></div><p className="text-xs text-stone-600 mt-2">Frete e área de entrega em definição.</p></div>
   {loadError&&<p role="alert" className="notice">{loadError} <button className="underline" onClick={()=>void refresh().catch(()=>{})}>Tentar novamente</button></p>}
   {error&&<p role="alert" className="notice">{error}</p>}{step>1&&planError&&<p role="alert" className="notice">{planError}</p>}
   <button className="button-primary w-full" disabled={busy||isLoading||!!loadError||!items.length||!!editingItem||(step>1&&!!planError)||editingAddress} onClick={()=>step<3?go((step+1) as 2|3):void checkout()}>{busy?'Salvando…':step===1?'Escolher entregas':step===2?'Revisar pedido':!user?'Entrar e continuar':'Confirmar pedido'}<ArrowRight size={17}/></button>
   {step===3&&<p className="text-xs text-stone-600">{DEMO_MODE?'Próximo passo: pagamento simulado.':'A reserva de 30 minutos começa ao iniciar o pagamento.'}</p>}
  </aside></div>
  {items.length>0&&<a href="#carrinho" className="lg:hidden fixed bottom-4 left-4 right-4 z-40 rounded-xl bg-[#493021] text-white px-5 py-4 shadow-lg flex justify-between gap-3 font-semibold text-sm"><span>Ver pedido · {totalMealsCount} un</span><span>{money(pricing.totalPrice)}</span></a>}
 </div>;
}
