'use client';
import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { CustomMealSelection, Order } from '@/types/database';
import { calculateVolumePrice } from '@/lib/rules';
import { allocated, Capacity, CapacityLimits, capacityFromOrders, DeliveryPlan, validatePlan } from '@/lib/scheduling';
import { useAuth } from './AuthContext';
import { DEMO_MODE } from '@/lib/mode';
import { api } from '@/lib/api';
import { PurchaseDraft, emptyPurchaseDraft, choosePurchaseDraft, migratePurchaseDraft } from '@/lib/purchase-draft';
import {demoLock,settingsLimits,ShopSettings,getSettings,readLocal,storageKey,writeLocal,profileAddress} from '@/lib/operations';
type CreateOrderData = { deliveries: DeliveryPlan[]; notes?:string };
interface CartState {
  draft:PurchaseDraft; draftReady:boolean; draftConflict:boolean; resolveDraft:(choice:'guest'|'saved')=>void; patchDraft:(patch:Partial<PurchaseDraft>)=>void;
  isLoading:boolean; loadError:string; reservePayment:(id:string)=>Promise<void>; items:CustomMealSelection[]; totalMealsCount:number; pricing:ReturnType<typeof calculateVolumePrice>;
  creditsBalance:number; orders:Order[]; capacity:Capacity; capacityLimits:CapacityLimits;
  editItem:(id:string,item:Omit<CustomMealSelection,'tempId'>)=>void;
  addItem:(item:Omit<CustomMealSelection,'tempId'>)=>void;
  updateItemQuantity:(id:string,delta:number)=>void; removeItem:(id:string)=>void; clearCart:()=>void;
  createOrder:(data:CreateOrderData)=>Promise<Order>;
  updateOrderStatus:(id:string,status:Order['status'])=>Promise<void>;
  updateOrderAdmin:(id:string,updates:Partial<Order>)=>void;
  scheduleBalance:(id:string,plans:DeliveryPlan[])=>Promise<void>;
  refresh:()=>Promise<void>;
}
const CartContext=createContext<CartState>(null!);
const STORAGE='vm_demo_orders_v2';
export function CartProvider({children}:{children:React.ReactNode}) {
  const {user,role,isLoading:authLoading}=useAuth();
  const [isLoading,setLoading]=useState(true);const [loadError,setLoadError]=useState('');const [draftOwner,setDraftOwner]=useState('');
  const [capacityLimits,setCapacityLimits]=useState<CapacityLimits>({});
  const [draft,setDraft]=useState<PurchaseDraft>(emptyPurchaseDraft);
  const items=draft.items;
  const setItems=(update:CustomMealSelection[]|((previous:CustomMealSelection[])=>CustomMealSelection[]))=>setDraft(previous=>({...previous,items:typeof update==='function'?update(previous.items):update}));
  const [draftConflict,setDraftConflict]=useState(false);
  const guestDraft=useRef<PurchaseDraft>(emptyPurchaseDraft());
  const owner='vm_purchase_'+(user?.id||'guest');
  const draftReady=!authLoading&&draftOwner===owner;
  const clearGuest=()=>{for(const key of ['vm_purchase_guest','vm_cart_guest','vm_builder_guest'])localStorage.removeItem(storageKey(key));};
  const patchDraft=(patch:Partial<PurchaseDraft>)=>setDraft(previous=>({...previous,...patch}));
  const resolveDraft=(choice:'guest'|'saved')=>{if(choice==='guest'){
    // Keep the account's previous draft as a local backup before replacing it.
    localStorage.setItem(storageKey(owner+'_previous'),JSON.stringify(draft));setDraft(guestDraft.current);
   }clearGuest();setDraftConflict(false);};
  const [orders,setOrders]=useState<Order[]>([]);
  const [remoteCapacity,setRemoteCapacity]=useState<Capacity>({});
  const capacity=useMemo(()=>DEMO_MODE?capacityFromOrders(orders):remoteCapacity,[orders,remoteCapacity]);
  const refresh=async()=>{
    setLoading(true);setLoadError('');try{
    if(DEMO_MODE){setOrders(readLocal<Order[]>(STORAGE,[]));setCapacityLimits(settingsLimits(await getSettings()));return;}
    const availability=await fetch('/api/availability',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Não foi possível consultar a produção. Tente novamente.');return r.json();});
    setRemoteCapacity(availability.capacity||{});setCapacityLimits(availability.limits||{});
    if(user){const data=await api('/api/orders');setOrders(data.orders);}else setOrders([]);
    }catch(e){setLoadError(e instanceof Error?e.message:'Falha ao carregar pedidos.');throw e;}finally{setLoading(false);}
  };
  useEffect(()=>{
    if(authLoading)return;
    const readDraft=(id:string)=>readLocal<PurchaseDraft|null>('vm_purchase_'+id,null)||migratePurchaseDraft(readLocal<CustomMealSelection[]>('vm_cart_'+id,[]),readLocal('vm_builder_'+id,null));
    const saved=readDraft(user?.id||'guest');const guest=user?readDraft('guest'):emptyPurchaseDraft();
    const selection=choosePurchaseDraft(saved,guest,!!user);guestDraft.current=guest;
    setDraft(selection.draft);setDraftConflict(selection.conflict);setDraftOwner(owner);
    if(selection.consumeGuest){localStorage.setItem(storageKey(owner),JSON.stringify(selection.draft));clearGuest();}
    setOrders([]);void refresh().catch(()=>{});
  },[user?.id,authLoading]);
  useEffect(()=>{if(draftReady&&!draftConflict)localStorage.setItem(storageKey(owner),JSON.stringify(draft));},[draft,draftReady,draftConflict,owner]);
  useEffect(()=>{if(!DEMO_MODE)return;const sync=()=>void refresh().catch(()=>{});window.addEventListener('storage',sync);window.addEventListener('vm-update',sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('vm-update',sync);};},[]);
  useEffect(()=>{if(authLoading)return;const timer=setInterval(()=>void refresh().catch(()=>{}),30000);return()=>clearInterval(timer);},[user?.id,authLoading]);
  const persist=(next:Order[])=>{writeLocal(STORAGE,next);setOrders(next);};
  const latest=():Order[]=>{try{return JSON.parse(localStorage.getItem(storageKey(STORAGE))||'[]');}catch{return [];}};
  const totalMealsCount=items.reduce((sum,i)=>sum+i.quantity,0);
  const creditsBalance=orders.filter(o=>o.user_id===user?.id&&['paid','preparing','in_delivery','delivered'].includes(o.status)).reduce((sum,o)=>sum+(o.items||[]).reduce((n,i)=>n+i.quantity-allocated(o.deliveries||[],i.id),0),0);
  const addItem:CartState['addItem']=(item)=>{
    if(!Number.isInteger(item.quantity)||item.quantity<2)return;
    const key=(i:Omit<CustomMealSelection,'tempId'>)=>[i.type,i.base?.id,i.protein?.id,...[i.side1?.id,i.side2?.id].sort(),i.completeDish?.id,i.specialInstructions||''].join('|');
    setItems(prev=>{const existing=prev.find(i=>key(i)===key(item));return existing?prev.map(i=>i.tempId===existing.tempId?{...i,quantity:i.quantity+item.quantity}:i):[...prev,{...item,tempId:crypto.randomUUID()}];});
  };
  const createOrder:CartState['createOrder']=async(data)=>{
    if(!user)throw new Error('Entre na sua conta antes de finalizar.');
    if(loadError)throw new Error(loadError);
    const error=validatePlan(items,data.deliveries,capacity,false,undefined,capacityLimits);if(error)throw new Error(error);
    if(!DEMO_MODE){const fingerprint=JSON.stringify({items,...data});const key='vm_submit_'+user.id;const previous=readLocal<{id:string;fingerprint:string}|null>(key,null);const requestId=previous?.fingerprint===fingerprint?previous.id:crypto.randomUUID();localStorage.setItem(storageKey(key),JSON.stringify({id:requestId,fingerprint}));const result=await api('/api/orders',{requestId,items,deliveries:data.deliveries,notes:data.notes});localStorage.removeItem(storageKey(key));setOrders(prev=>[result.order,...prev]);setDraft(emptyPurchaseDraft());void refresh().catch(()=>{});return result.order;}
    const id=crypto.randomUUID();
    const order:Order={id,user_id:user.id,order_type:data.deliveries.length>1?'package':'single',status:'pending',total_amount:calculateVolumePrice(totalMealsCount).totalPrice,quantity_meals:totalMealsCount,delivery_date:data.deliveries[0]?.date||null,delivery_shift:user.preferred_delivery_period||null,payment_method:'pix',created_at:new Date().toISOString(),deliveries:data.deliveries.map(p=>({...p,preferred_period:user.preferred_delivery_period,address:profileAddress(user),address_mode:'primary',status:'scheduled'})),profile:user,notes:data.notes,
      shipping_address_snapshot:{recipient_name:user.full_name||'',recipient_phone:user.phone||'',cep:user.cep||'',street:user.street||'',number:user.number||'',neighborhood:user.neighborhood||'',city:user.city||'',state:user.state,complement:user.complement||''},
      items:items.map(i=>({id:i.tempId,order_id:id,item_type:i.type,name:i.name,base:i.base,protein:i.protein,side1:i.side1,side2:i.side2,complete_dish:i.completeDish,quantity:i.quantity,special_instructions:i.specialInstructions,created_at:new Date().toISOString()}))};
    await demoLock(()=>persist([order,...latest()]));setDraft(emptyPurchaseDraft());return order;
  };
  const updateOrderStatus:CartState['updateOrderStatus']=async(id,status)=>demoLock(()=>{
    if(!DEMO_MODE)throw new Error('Alterações de pagamento são confirmadas pelo servidor.');
    const all=latest();const order=all.find(o=>o.id===id);if(!order||!(role==='admin'||order.user_id===user?.id))throw new Error('Pedido indisponível.');
    if(status==='paid'&&order.status==='pending'){
      const error=validatePlan((order.items||[]).map(i=>({tempId:i.id,quantity:i.quantity})),order.deliveries||[],capacityFromOrders(all.filter(o=>o.id!==id)),false,undefined,settingsLimits(readLocal<ShopSettings>('vm_settings',{whatsapp:'',closures:[]})));
      if(error){order.deliveries=[];order.delivery_date=null;order.needs_rescheduling=true;}
    }else if(role!=='admin')throw new Error('Ação não permitida.');
    persist(all.map(o=>o.id===id?{...o,status,paid_at:status==='paid'?new Date().toISOString():o.paid_at}:o));
  });
  const updateOrderAdmin:CartState['updateOrderAdmin']=()=>{throw new Error('Use o planejamento de entregas para alterar datas sem exceder a produção.');};
  const scheduleBalance:CartState['scheduleBalance']=async(id,plans)=>{
    if(!DEMO_MODE){await api('/api/orders/'+id+'/schedule',{deliveries:plans});await refresh();return;}
    return demoLock(()=>{const all=latest();const order=all.find(o=>o.id===id&&o.user_id===user?.id);if(!order||!['paid','preparing','in_delivery','delivered','pending'].includes(order.status))throw new Error('Pedido indisponível.');
    const pending=order.status==='pending';if(pending&&order.reservation_expires_at)throw new Error('Pagamento já iniciado. Fale com a equipe para alterar as datas.');
    plans=plans.map(p=>({...p,preferred_period:user!.preferred_delivery_period,address:profileAddress(user!),address_mode:'primary',status:'scheduled'}));
    const remaining=(order.items||[]).map(i=>({tempId:i.id,quantity:i.quantity-(pending?0:allocated(order.deliveries||[],i.id))})).filter(i=>i.quantity>0);
    if(!pending&&plans.some(p=>(order.deliveries||[]).some(d=>d.date===p.date)))throw new Error('Esta data já tem uma entrega neste pedido. Escolha outra produção.');
    const error=validatePlan(remaining,plans,capacityFromOrders(all.filter(o=>o.id!==id)),false,undefined,settingsLimits(readLocal<ShopSettings>('vm_settings',{whatsapp:'',closures:[]})));if(error)throw new Error(error);
    persist(all.map(o=>o.id===id?{...o,deliveries:pending?plans:[...(o.deliveries||[]),...plans],delivery_date:pending?plans[0].date:o.delivery_date}:o));});
  };
  const reservePayment=async(id:string)=>{if(!DEMO_MODE)return;await demoLock(()=>{const all=latest();const order=all.find(o=>o.id===id&&o.user_id===user?.id);if(!order||order.status!=='pending')throw new Error('Pedido indisponível.');if(order.reservation_expires_at&&Date.parse(order.reservation_expires_at)>Date.now())return;const error=validatePlan((order.items||[]).map(i=>({tempId:i.id,quantity:i.quantity})),order.deliveries||[],capacityFromOrders(all.filter(o=>o.id!==id)),false,undefined,settingsLimits(readLocal<ShopSettings>('vm_settings',{whatsapp:'',closures:[]})));if(error)throw new Error(error);order.reservation_expires_at=new Date(Date.now()+30*60000).toISOString();persist(all);});};
  return <CartContext.Provider value={{draft,draftReady,draftConflict,resolveDraft,patchDraft,isLoading,loadError,reservePayment,items,orders,capacity,capacityLimits,totalMealsCount,pricing:calculateVolumePrice(totalMealsCount),creditsBalance,addItem,editItem:(id,item)=>setItems(prev=>prev.map(i=>i.tempId===id?{...item,tempId:id}:i)),updateItemQuantity:(id,delta)=>setItems(prev=>prev.map(i=>i.tempId===id?{...i,quantity:Math.max(2,i.quantity+delta)}:i)),removeItem:id=>setItems(prev=>prev.filter(i=>i.tempId!==id)),clearCart:()=>setDraft(emptyPurchaseDraft()),createOrder,updateOrderStatus,updateOrderAdmin,scheduleBalance,refresh}}>{children}</CartContext.Provider>;
}
export const useCart=()=>useContext(CartContext);
