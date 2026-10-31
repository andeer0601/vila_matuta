import { api } from './api';

import { DEMO_MODE } from './mode';

import { Order, Profile, ShippingAddressSnapshot } from '@/types/database';

import { validateCapacityChange, capacityFromOrders, CapacityLimits, DeliveryPlan, isProductionDate, todayInSaoPaulo,validatePlan } from './scheduling';

export type SavedAddress={id:string;user_id:string;address:ShippingAddressSnapshot};

export type ShopSettings={whatsapp:string;capacity_limits?:CapacityLimits;closures:{production_date:string;reason:string}[]};

export const settingsLimits=(settings:ShopSettings):CapacityLimits=>({...settings.capacity_limits,...Object.fromEntries(settings.closures.map(d=>[d.production_date,0]))});

export const ORDER_STORAGE='vm_demo_orders_v2';

export function resetDemoStorage(){if(!DEMO_MODE)throw new Error('Reinicialização disponível apenas na demonstração.');for(const key of Object.keys(localStorage))if(key.startsWith('vm_public_demo_v1_'))localStorage.removeItem(key);}
export const storageKey=(key:string)=>DEMO_MODE?'vm_public_demo_v1_'+key:key;
export function readLocal<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(storageKey(key))||'null')??fallback;}catch{return fallback;}}

export function writeLocal(key:string,value:unknown){localStorage.setItem(storageKey(key),JSON.stringify(value));window.dispatchEvent(new Event('vm-update'));}

export const profileAddress=(p:Profile):ShippingAddressSnapshot=>({recipient_name:p.full_name||'',recipient_phone:p.phone||'',cep:p.cep||'',street:p.street||'',number:p.number||'',neighborhood:p.neighborhood||'',complement:p.complement||'',city:p.city||'',state:p.state||''});

export async function demoLock<T>(fn:()=>T|Promise<T>):Promise<T>{if(navigator.locks)return navigator.locks.request('vm-operations',fn);throw new Error('Este navegador não permite testar reservas simultâneas com segurança.');}

export async function getSettings():Promise<ShopSettings>{if(DEMO_MODE)return readLocal('vm_settings',{whatsapp:'',closures:[]});return api('/api/operations');}

export async function operate(user:Profile,input:Record<string,unknown>){if(!DEMO_MODE)return api('/api/operations',input);if(user.role!=='admin')throw new Error('Acesso restrito.');return demoLock(()=>{

 const settings=readLocal<ShopSettings>('vm_settings',{whatsapp:'',closures:[]});const orders=readLocal<Order[]>(ORDER_STORAGE,[]);

 if(input.action==='whatsapp'){const phone=String(input.whatsapp||'').replace(/\D/g,'');if(phone&&!/^[0-9]{10,15}$/.test(phone))throw new Error('Informe DDI, DDD e telefone.');settings.whatsapp=phone;writeLocal('vm_settings',settings);}

 else if(input.action==='capacity'){const date=String(input.date);const limit=input.limit===null?120:input.limit;const error=validateCapacityChange(date,limit,capacityFromOrders(orders)[date]||0);if(error)throw new Error(error);if(settings.closures.some(d=>d.production_date===date))throw new Error('Reabra a produção antes de alterar a capacidade.');settings.capacity_limits={...settings.capacity_limits};if(input.limit===null)delete settings.capacity_limits[date];else settings.capacity_limits[date]=limit as number;writeLocal('vm_settings',settings);}
 else if(input.action==='closure'){const date=String(input.date);if(!isProductionDate(date))throw new Error('Data inválida.');if(input.closed&&(capacityFromOrders(orders)[date]||0)>0)throw new Error('Esta produção tem pedidos ou reservas. Resolva os pedidos antes de bloquear a data.');settings.closures=settings.closures.filter(d=>d.production_date!==date);if(input.closed)settings.closures.push({production_date:date,reason:String(input.reason||'')});writeLocal('vm_settings',settings);}

 else if(input.action==='move'){const order=orders.find(o=>o.id===input.orderId);const plan=order?.deliveries?.find(p=>p.id===input.planId);if(!order||!plan||['pending','cancelled'].includes(order.status)||(plan.status||'scheduled')!=='scheduled')throw new Error('Produção indisponível para remarcação.');const updated={...plan,date:String(input.date)};const otherOrders=orders.map(o=>o.id===order.id?{...o,deliveries:o.deliveries?.filter(p=>p.id!==plan.id)}:o);const items=(order.items||[]).map(i=>({tempId:i.id,quantity:i.quantity}));const cap=capacityFromOrders(otherOrders);const error=validatePlan(items,[updated],cap,false,undefined,settingsLimits(settings));if(error)throw new Error(error);if(order.deliveries?.some(p=>p.id!==plan.id&&p.date===updated.date))throw new Error('Já existe produção neste dia para o pedido.');plan.date=updated.date;if(plan.address_mode!=='specific'){const current=readLocal<Record<string,Profile>>('vm_profiles',{})[order.user_id]||order.profile;if(current)plan.address=profileAddress(current);}order.delivery_date=order.deliveries!.map(p=>p.date).sort()[0];writeLocal(ORDER_STORAGE,orders);}
 else if(input.action==='status'){const order=orders.find(o=>o.id===input.orderId);const plan=order?.deliveries?.find(p=>p.id===input.planId);if(!order||!plan||['pending','cancelled'].includes(order.status))throw new Error('Pedido não pago.');const next:Record<string,string>={scheduled:'preparing',preparing:'ready',ready:'in_delivery',in_delivery:'delivered'};if(next[plan.status||'scheduled']!==input.status)throw new Error('Transição inválida.');plan.status=input.status as DeliveryPlan['status'];plan.status_updated_at=new Date().toISOString();writeLocal(ORDER_STORAGE,orders);}

 });}

export async function getAddresses(user:Profile):Promise<SavedAddress[]>{if(!DEMO_MODE)return (await api('/api/account')).addresses;const saved=readLocal<SavedAddress[]>('vm_addresses_'+user.id,[]);if(!saved.length&&user.street){saved.push({id:crypto.randomUUID(),user_id:user.id,address:profileAddress(user)});writeLocal('vm_addresses_'+user.id,saved);}return saved;}

export async function saveAddress(user:Profile,input:{address?:ShippingAddressSnapshot;addressId?:string;makePrimary:boolean;orderId?:string;planId?:string;period?:string|null}){if(!DEMO_MODE)return api('/api/account',{action:'address',...input});return demoLock(async()=>{

 const saved=await getAddresses(user);let chosen=saved.find(a=>a.id===input.addressId);if(!chosen&&input.address){if(!input.address.street.trim()||!input.address.number.trim()||!input.address.city.trim()||!input.address.recipient_name.trim())throw new Error('Preencha nome, rua, número e cidade.');if(!/^[A-Za-z]{2}$/.test(input.address.state||'')||!/^\d{8}$/.test(input.address.cep.replace(/\D/g,''))||!/^\d{10,15}$/.test(input.address.recipient_phone.replace(/\D/g,'')))throw new Error('Confira CEP, UF e telefone.');input.address.state=input.address.state!.toUpperCase();chosen=saved.find(a=>JSON.stringify(a.address)===JSON.stringify(input.address));if(!chosen){chosen={id:crypto.randomUUID(),user_id:user.id,address:input.address};saved.push(chosen);}}

 if(!chosen)throw new Error('Selecione um endereço.');const snapshot=chosen.address;const orders=readLocal<Order[]>(ORDER_STORAGE,[]);

 if(input.orderId){const order=orders.find(o=>o.id===input.orderId&&o.user_id===user.id);const plan=order?.deliveries?.find(p=>p.id===input.planId);if(!order||!plan||order.status==='cancelled')throw new Error('Entrega indisponível.');if(plan.date<=todayInSaoPaulo()||['in_delivery','delivered'].includes(plan.status||''))throw new Error('Prazo encerrado. Entre em contato pelo WhatsApp.');Object.assign(plan,{address:snapshot,address_id:chosen.id,address_mode:'specific',period:input.period||null});}

 if(input.makePrimary){const profiles=readLocal<Record<string,Profile>>('vm_profiles',{});const old=profiles[user.id]||user;profiles[user.id]={...old,...snapshot,full_name:old.full_name,phone:old.phone,primary_address_id:chosen.id};writeLocal('vm_profiles',profiles);for(const o of orders.filter(o=>o.user_id===user.id&&o.status!=='cancelled'))for(const p of o.deliveries||[]){if(p.date>todayInSaoPaulo()&&p.address_mode!=='specific'&&!['in_delivery','delivered'].includes(p.status||'')){p.address=snapshot;p.address_id=chosen.id;}}}

 writeLocal('vm_addresses_'+user.id,saved);writeLocal(ORDER_STORAGE,orders);return {id:chosen.id};

 });}
