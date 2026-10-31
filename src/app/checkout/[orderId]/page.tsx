'use client';
import { useEffect,useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/lib/mode';
import { api } from '@/lib/api';
import { money,planCount } from '@/lib/scheduling';
export default function Checkout() {
 const {orderId}=useParams();const {orders,updateOrderStatus,refresh,reservePayment,isLoading,loadError}=useCart();const {user}=useAuth();
 const order=orders.find(o=>o.id===orderId&&o.user_id===user?.id);
 const [now,setNow]=useState(Date.now());
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{if(DEMO_MODE)return;const timer=setInterval(()=>void refresh().catch(()=>{}),8000);return()=>clearInterval(timer);},[user?.id]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(DEMO_MODE||!user)return;const q=new URLSearchParams(window.location.search);const transaction=q.get('transaction_nsu'),slug=q.get('slug');if(transaction&&slug)void api('/api/orders/'+orderId+'/reconcile',{transaction,slug}).then(()=>refresh()).catch(e=>setError(e.message));},[user?.id,orderId]);
 async function pay(){setBusy(true);setError('');try{if(DEMO_MODE)await reservePayment(order!.id);else {const data=await api('/api/orders/'+order!.id+'/checkout',{});window.location.assign(data.url);}}catch(e){setError(e instanceof Error?e.message:'Não foi possível continuar.');}finally{setBusy(false);}}
 if(isLoading&&!order)return <p role="status" className="p-10">Carregando pedido…</p>;
 if(loadError&&!order)return <p role="alert" className="notice m-10">{loadError} <button onClick={()=>void refresh().catch(()=>{})}>Tentar novamente</button></p>;
 if(!order)return <div className="max-w-xl mx-auto p-8 my-10 rustic-card"><h1 className="text-2xl font-bold">Seu pedido</h1><p className="my-4">Entre na sua conta para acessar este pedido ou confira seus pedidos salvos.</p><Link className="button-secondary" href="/meus-pedidos">Meus pedidos</Link></div>;
 const paid=['paid','preparing','in_delivery','delivered'].includes(order.status);
 return <div className="max-w-3xl mx-auto px-5 py-12"><section className="rustic-card p-6 sm:p-9 space-y-6">
 <span className="eyebrow">{DEMO_MODE?'DEMONSTRAÇÃO · NENHUMA COBRANÇA REAL':paid?'PAGAMENTO CONFIRMADO':'REVISE SEU PEDIDO'}</span>
 <h1 className="text-3xl font-bold">{paid?(DEMO_MODE?'Pedido de teste confirmado':'Tudo certo com seu pagamento!'):'Falta pouco para suas matutinhas.'}</h1>
 {order.needs_rescheduling&&<p className="notice">Seu pagamento foi recebido, mas uma das produções ficou indisponível. Todas as marmitas estão no seu saldo. Escolha novas datas em Meus pedidos.</p>}
 <div className="flex justify-between border-y py-5"><span>{order.quantity_meals} marmitas</span><strong className="text-2xl">{money(order.total_amount)}</strong></div>
 <div className="space-y-3">{order.items?.map(i=><div key={i.id}><strong>{i.quantity} × {i.name}</strong><p className="text-sm text-stone-500">{[i.side1?.name,i.side2?.name].filter(Boolean).join(' + ')}</p></div>)}</div>
 <div className="bg-[#FAF3E7] rounded-xl p-5 space-y-3"><h2 className="font-bold text-xl">Suas produções</h2><p className="text-sm">A entrega poderá ocorrer no dia da produção ou no dia seguinte.</p>{[...(order.deliveries||[])].sort((a,b)=>a.date.localeCompare(b.date)).map(p=><div key={p.id}><strong>{p.date.split('-').reverse().join('/')} · {planCount(p)} marmitas</strong><ul className="text-sm mt-1">{order.items?.filter(i=>p.quantities[i.id]).map(i=><li key={i.id}>{p.quantities[i.id]} × {i.name}</li>)}</ul></div>)}<p className="text-sm">{order.quantity_meals-(order.deliveries||[]).reduce((n,p)=>n+planCount(p),0)} marmitas para agendar depois.</p></div>
 {error&&<p role="alert" className="notice">{error} <Link href="/meus-pedidos" className="underline">Revisar planejamento</Link></p>}
 {!paid&&order.status==='pending'&&<><p className="text-sm text-stone-600">{DEMO_MODE?'Este pedido existe apenas neste navegador. Reserve primeiro e depois simule a confirmação.':'Ao seguir para a InfinitePay, suas vagas ficam reservadas por 30 minutos. Após esse prazo elas são liberadas. Pagamentos recebidos depois são verificados novamente; se não houver capacidade, seu saldo pago fica disponível para reagendar.'}</p><button className="button-primary w-full" disabled={busy} onClick={pay}>{busy?'Aguarde…':DEMO_MODE?'Reservar vagas por 30 minutos':'Pagar com InfinitePay'}</button></>}
 {!paid&&order.reservation_expires_at&&<div className="notice space-y-3"><p>{Date.parse(order.reservation_expires_at)>now?'Reserva ativa · '+Math.min(30,Math.ceil((Date.parse(order.reservation_expires_at)-now)/60000))+' min restantes':'Reserva expirada. A disponibilidade será verificada novamente.'}</p>{DEMO_MODE&&<button className="button-secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await updateOrderStatus(order.id,'paid');setError('');}catch(e){setError(e instanceof Error?e.message:'Não foi possível confirmar.');}finally{setBusy(false);}}}>Simular pagamento recebido</button>}</div>}
 <Link className="button-secondary w-full" href="/meus-pedidos">Acompanhar pedidos e entregas</Link>
 </section></div>;
}
