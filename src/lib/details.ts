import {DEMO_MODE} from './mode';
import {api} from './api';
import {DEMO_PROFILES} from './supabase/mock-data';
import {readLocal,ORDER_STORAGE,SavedAddress} from './operations';
import type {Order,Profile} from '@/types/database';
export type UserDetails={profile:Profile;addresses:SavedAddress[];orders:Order[];total:number;hasMore:boolean};
export async function getUserDetails(viewer:Profile,id:string,page=0):Promise<UserDetails>{
 if(!DEMO_MODE)return api('/api/users/'+encodeURIComponent(id)+'?page='+page);
 const target=id==='me'?viewer.id:id;
 if(viewer.disabled_at||(viewer.role!=='admin'&&target!==viewer.id))throw new Error('Usuário indisponível.');
 const profile=readLocal<Record<string,Profile>>('vm_profiles',{})[target]||DEMO_PROFILES[target];if(!profile)throw new Error('Usuário indisponível.');
 const orders=readLocal<Order[]>(ORDER_STORAGE,[]).filter(o=>o.user_id===target).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 return {profile,addresses:readLocal<SavedAddress[]>('vm_addresses_'+target,[]),orders:orders.slice(page*25,page*25+25),total:orders.length,hasMore:(page+1)*25<orders.length};
}
export async function getOrderDetails(viewer:Profile,id:string):Promise<Order>{
 if(!DEMO_MODE)return (await api('/api/orders/'+encodeURIComponent(id))).order;
 const order=readLocal<Order[]>(ORDER_STORAGE,[]).find(o=>o.id===id&&(viewer.role==='admin'||o.user_id===viewer.id));
 if(!order||viewer.disabled_at)throw new Error('Pedido indisponível.');return order;
}
export const orderStatus:Record<string,string>={pending:'Aguardando pagamento',paid:'Pago',preparing:'Em preparo',in_delivery:'Em entrega',delivered:'Entregue',cancelled:'Cancelado'};
export const displayDate=(value?:string|null)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'Não informado';

export function orderProgress(order:Order){if(order.status==='cancelled')return 'Cancelado';const plans=order.deliveries||[];const assigned=plans.reduce((n,p)=>n+Object.values(p.quantities).reduce((a,b)=>a+b,0),0);return plans.length&&plans.every(p=>p.status==='delivered')&&assigned>=order.quantity_meals?'Finalizado':'Em aberto';}
