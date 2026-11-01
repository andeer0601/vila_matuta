'use client';
import { useEffect,useRef,useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, LockKeyhole } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/lib/mode';
import {validPaymentUrl} from '@/lib/payment-links';
import {ContactSupport} from '@/components/ContactSupport';
import { api } from '@/lib/api';
import { money,planCount } from '@/lib/scheduling';
import { deliveryWindow,shortDate } from '@/components/DeliveryPlanner';
export default function Checkout(){
 const {orderId}=useParams();const {orders,updateOrderStatus,refresh,reservePayment,isLoading,loadError}=useCart();const {user}=useAuth();
 const order=orders.find(o=>o.id===orderId&&o.user_id===user?.id);
 const paid=!!order&&['paid','preparing','in_delivery','delivered'].includes(order.status);
 const [now,setNow]=useState(Date.now());const [error,setError]=useState('');const [copied,setCopied]=useState(false);const [busy,setBusy]=useState(false);
 const title=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(paid){title.current?.focus({preventScroll:true});title.current?.scrollIntoView({block:'start',behavior:'auto'});}},[paid]);
 useEffect(()=>{if(DEMO_MODE)return;const timer=setInterval(()=>void refresh().catch(()=>{}),8000);return()=>clearInterval(timer);},[user?.id]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(DEMO_MODE||!user)return;const q=new URLSearchParams(window.location.search);const transaction=q.get('transaction_nsu'),slug=q.get('slug');if(transaction&&slug)void api('/api/orders/'+orderId+'/reconcile',{transaction,slug}).then(()=>refresh()).catch(e=>setError(e.message));},[user?.id,orderId]);
 async function pay(){if(!order||busy)return;setBusy(true);setError('');try{if(DEMO_MODE){await reservePayment(order.id);await updateOrderStatus(order.id,'paid');}else{const data=await api('/api/orders/'+order.id+'/checkout',{action:order.payment_link_state==='ready'?'retrieve':'create'});if(!validPaymentUrl(data.url))throw new Error('Link indisponível. Fale com a equipe.');window.location.assign(data.url);}}catch(e){setError(e instanceof Error?e.message:'Não foi possível continuar.');}finally{setBusy(false);}}
 async function copyPayment(){if(!order||busy)return;setBusy(true);setError('');setCopied(false);try{const url=DEMO_MODE?window.location.origin+'/checkout/'+order.id:(await api('/api/orders/'+order.id+'/checkout',{action:'retrieve'})).url;if(!DEMO_MODE&&!validPaymentUrl(url))throw new Error('Link indisponível.');await navigator.clipboard.writeText(url);setCopied(true);}catch(e){setError(e instanceof Error?e.message:'Não foi possível copiar.');}finally{setBusy(false);}}
 if(isLoading&&!order)return <p role="status" className="p-10">Carregando pedido…</p>;
 if(loadError&&!order)return <p role="alert" className="notice m-10">{loadError} <button onClick={()=>void refresh().catch(()=>{})}>Tentar novamente</button></p>;
 if(!order)return <div className="max-w-xl mx-auto p-8 my-10 rustic-card"><h1 className="text-2xl font-bold">Seu pedido</h1><p className="my-4">Entre no seu perfil para acessar este pedido.</p><Link className="button-secondary" href="/meus-pedidos">Meus pedidos</Link></div>;
 const paymentBlocked=!DEMO_MODE&&['expired','review'].includes(order.payment_link_state||'');
 const address=order.shipping_address_snapshot;
 const balance=order.quantity_meals-(order.deliveries||[]).reduce((n,p)=>n+planCount(p),0);
 return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8"><section className="rustic-card p-5 sm:p-8 space-y-6">
  <header className="space-y-3">{paid?<CheckCircle2 size={36} className="text-[#71421E]"/>:<LockKeyhole size={28} className="text-[#71421E]"/>}<span className="eyebrow block">{DEMO_MODE?'DEMONSTRAÇÃO · SEM COBRANÇA':paid?'PAGAMENTO CONFIRMADO':'ÚLTIMO PASSO'}</span><h1 ref={title} tabIndex={-1} className="text-3xl font-bold scroll-mt-40">{paid?(DEMO_MODE?'Pedido de teste confirmado':'Pedido confirmado'):order.status==='cancelled'?'Pedido cancelado':'Vamos confirmar seu pedido?'}</h1><p className="text-sm text-stone-600">Pedido #{order.id.slice(0,8)}</p><p role="status" className="sr-only">{paid?'Pagamento confirmado. Consulte suas entregas abaixo.':''}</p></header>
  {order.needs_rescheduling&&<p role="alert" className="notice">Pagamento recebido. A produção ficou indisponível; suas marmitas estão no saldo para escolher novas datas.</p>}
  <div className="flex justify-between items-center gap-3 border-y py-5"><span>{order.quantity_meals} marmitas</span><strong className="text-2xl">{money(order.total_amount)}</strong></div>
  {!paid&&<p className="text-xs text-stone-600">Valor das refeições. Frete e área de entrega em definição.</p>}
  <div className="space-y-3">{order.items?.map(i=><div key={i.id}><strong>{i.quantity} × {i.name}</strong><p className="text-sm text-stone-600">{[i.side1?.name,i.side2?.name].filter(Boolean).join(' + ')}</p>{i.special_instructions&&<p className="text-sm mt-1">{i.special_instructions}</p>}</div>)}</div>
  <section className="bg-[#FAF3E7] rounded-xl p-4 sm:p-5 space-y-4"><h2 className="font-bold text-xl">Suas entregas</h2>{[...(order.deliveries||[])].sort((a,b)=>a.date.localeCompare(b.date)).map(p=><div key={p.id} className="space-y-1"><strong>{deliveryWindow(p.date)}</strong><p className="text-sm text-stone-600">Produção {shortDate(p.date)} · {p.period||p.preferred_period||'Sem preferência de período'}</p><ul className="text-sm">{order.items?.filter(i=>p.quantities[i.id]).map(i=><li key={i.id}>{p.quantities[i.id]} × {i.name}</li>)}</ul></div>)}{balance>0&&<p className="text-sm font-semibold">{balance} marmitas para agendar depois.</p>}</section>
  {address&&<section className="text-sm space-y-1"><h2 className="font-bold text-lg mb-2">Endereço</h2><p>{address.recipient_name}</p><p>{address.street}, {address.number}{address.complement?' · '+address.complement:''}</p><p>{address.neighborhood} · {address.city}/{address.state}</p></section>}
  {order.profile&&(order.profile.dietary_restrictions?.length>0||order.profile.dietary_notes)&&<section className="text-sm space-y-1"><h2 className="font-bold text-lg mb-2">Cuidados</h2><p>{order.profile.dietary_restrictions.join(', ')}</p><p>{order.profile.dietary_notes}</p></section>}
  {error&&<p role="alert" className="notice">{error} <Link href="/meus-pedidos" className="underline">Revisar entregas</Link></p>}
  {!paid&&order.status==='pending'&&<div className="space-y-3"><button className="button-primary w-full" disabled={busy||paymentBlocked} onClick={pay}>{busy?'Confirmando…':DEMO_MODE?'Simular pagamento':order.payment_link_state==='ready'?'Abrir pagamento existente':'Gerar link e pagar'}</button><p className="text-xs text-stone-600">{DEMO_MODE?'Sem Pix, cartão ou cobrança real.':'Ao iniciar o pagamento, reservamos as vagas por 30 minutos.'}</p></div>}
  {!paid&&order.status==='pending'&&(DEMO_MODE||order.payment_link_state==='ready')&&<button className="button-secondary w-full" disabled={busy} onClick={copyPayment}>{DEMO_MODE?'Copiar acesso ao pagamento de teste':'Copiar link de pagamento'}</button>}{copied&&<p role="status">Link copiado.</p>}{paymentBlocked&&<div className="notice space-y-3"><p>{order.payment_link_state==='expired'?'O link expirou.':'Este pagamento precisa de conferência.'} Fale com a equipe antes de tentar pagar novamente.</p><ContactSupport/></div>}
  {!paid&&order.reservation_expires_at&&<p role="status" className="notice">{Date.parse(order.reservation_expires_at)>now?'Reserva ativa · '+Math.min(30,Math.ceil((Date.parse(order.reservation_expires_at)-now)/60000))+' min restantes':'Reserva expirada. A disponibilidade será verificada novamente.'}</p>}
  <Link className={paid?'button-primary w-full':'button-secondary w-full'} href="/meus-pedidos">Ver pedidos e entregas</Link>
 </section></div>;
}
