import type { CustomMealSelection, Ingredient } from '@/types/database';
import { addDateDays, allocated, Capacity, DAILY_CAPACITY, DeliveryPlan, nextAvailableDate, planCount } from './scheduling';

export type MealEditor = { id?: string; type: 'custom'|'complete_dish'; base?: Ingredient; protein?: Ingredient; sides: Ingredient[]; dish?: Ingredient; quantity: number; notes: string };
export type PurchaseDraft = { items: CustomMealSelection[]; plans: DeliveryPlan[]; mode: 'single'|'scheduled'; step: 1|2|3; editor: MealEditor };
export const emptyEditor = (): MealEditor => ({ type:'complete_dish', sides:[], quantity:2, notes:'' });
export const emptyPurchaseDraft = (): PurchaseDraft => ({items:[],plans:[],mode:'single',step:1,editor:emptyEditor()});
export const hasDraft = (draft: PurchaseDraft) => !!(draft.items.length || draft.editor.base || draft.editor.protein || draft.editor.dish || draft.editor.sides.length || draft.editor.notes);

// A guest and an account draft are never silently merged or overwritten.
export function choosePurchaseDraft(saved: PurchaseDraft, guest: PurchaseDraft, signedIn: boolean) {
 return { draft: signedIn && !hasDraft(saved) && hasDraft(guest) ? guest : saved, conflict: signedIn && hasDraft(saved) && hasDraft(guest), consumeGuest: signedIn && !hasDraft(saved) && hasDraft(guest) };
}

export function migratePurchaseDraft(items: CustomMealSelection[], builder: any): PurchaseDraft {
 return {items:Array.isArray(items)?items:[],plans:Array.isArray(builder?.plans)?builder.plans:[],mode:builder?.mode==='scheduled'?'scheduled':'single',step:1,editor:builder?{id:builder.editingItem||undefined,type:builder.tab==='custom'?'custom':'complete_dish',base:builder.base,protein:builder.protein,sides:builder.sides||[],dish:builder.dish,quantity:builder.quantity||2,notes:builder.notes||''}:emptyEditor()};
}

// Suggest valid deliveries without singles or exceeding a day's capacity.
// Quantities that cannot fit remain available to schedule later.
export function suggestDeliveries(items: Pick<CustomMealSelection,'tempId'|'quantity'>[], capacity: Capacity, interval=7, from?: string, id=()=>crypto.randomUUID()): DeliveryPlan[] {
 const remaining = Object.fromEntries(items.map(i=>[i.tempId,i.quantity]));
 const plans: DeliveryPlan[]=[];
 let start=from;
 for(let index=0;index<200 && Object.values(remaining).some(n=>n>=2);index++){
  const date=nextAvailableDate(start,capacity,2);if(!date)break;
  let free=DAILY_CAPACITY-(capacity[date]||0);
  const quantities:Record<string,number>={};
  for(const item of items){let count=Math.min(free,remaining[item.tempId]);if(remaining[item.tempId]-count===1)count--;if(count<2)continue;quantities[item.tempId]=count;remaining[item.tempId]-=count;free-=count;}
  if(Object.keys(quantities).length)plans.push({id:id(),date,quantities});
  start=addDateDays(date,interval);
 }
 return plans;
}

// Divide an existing delivery into two when possible; otherwise use unassigned balance.
export function addSuggestedDelivery(items: Pick<CustomMealSelection,'tempId'|'quantity'>[], plans: DeliveryPlan[], capacity: Capacity, interval=7): DeliveryPlan[] {
 const remaining=items.map(i=>({...i,quantity:i.quantity-allocated(plans,i.tempId)})).filter(i=>i.quantity>=2);
 const last=plans.map(p=>p.date).filter(Boolean).sort().at(-1);
 const blocked={...capacity,...Object.fromEntries(plans.map(p=>[p.date,DAILY_CAPACITY]))};
 if(remaining.length){const [next]=suggestDeliveries(remaining,blocked,interval,last?addDateDays(last,interval):undefined);return next?[...plans,next]:plans;}
 const source=[...plans].reverse().find(p=>Object.values(p.quantities).some(n=>n>=4));
 if(!source)return plans;
 const quantities=Object.fromEntries(Object.entries(source.quantities).filter(([,n])=>n>=4).map(([key,n])=>[key,Math.floor(n/2)]));
 const date=nextAvailableDate(last?addDateDays(last,interval):undefined,blocked,planCount({quantities} as DeliveryPlan));
 if(!date)return plans;
 return [...plans.map(p=>p.id===source.id?{...p,quantities:Object.fromEntries(Object.entries(p.quantities).map(([key,n])=>[key,n-(quantities[key]||0)]))}:p),{id:crypto.randomUUID(),date,quantities,period:source.period}];
}
