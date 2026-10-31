import {protect,reveal} from '@/lib/server/privacy';
import {object,period,text} from '@/lib/server/input';
import {ApiError,operationError} from '@/lib/server/errors';
import { NextRequest,NextResponse } from 'next/server';
import { availability,body,customer,failure } from '@/lib/server/database';
import { INITIAL_INGREDIENTS } from '@/lib/supabase/mock-data';
import { calculateVolumePrice } from '@/lib/rules';
import { validatePlan,DeliveryPlan } from '@/lib/scheduling';
import { CustomMealSelection,Ingredient,Order } from '@/types/database';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
  try{const {db,user,profile}=await customer(req);let query=db.from('meal_purchases').select('*').order('created_at',{ascending:false});if(profile.role!=='admin')query=query.eq('user_id',user.id);const {data,error}=await query;if(error)throw new ApiError('Não foi possível carregar os pedidos.');const {data:holds,error:holdsError}=await db.from('production_reservations').select('purchase_id,expires_at').in('purchase_id',data.map(r=>r.id));if(holdsError)throw new ApiError('Não foi possível carregar as reservas.');return NextResponse.json({orders:data.map(r=>({...reveal(r.payload,r.user_id),status:r.status,paid_at:r.paid_at,needs_rescheduling:r.needs_rescheduling,infinitepay_checkout_url:r.checkout_url,checkout_needs_attention:!!r.checkout_claimed_at&&!r.checkout_url&&r.status==='pending',reservation_expires_at:holds?.find(h=>h.purchase_id===r.id)?.expires_at}))});}catch(e){return failure(e);}
}
export async function POST(req:NextRequest) {
  try {
    const {db,user,profile}=await customer(req);
    if(!profile.onboarding_completed||!profile.street||!profile.number||!profile.phone)throw new ApiError('Complete seu perfil e endereço antes de pedir.');
    const input=await body(req);
    if(!Array.isArray(input.items)||input.items.length<1||input.items.length>100||!Array.isArray(input.deliveries))throw new ApiError('Pedido inválido.');
    const lookup=(value:any,category:Ingredient['category'])=>{const found=INITIAL_INGREDIENTS.find(i=>i.id===value?.id&&i.category===category&&i.is_available);if(!found)throw new ApiError('Um ingrediente não está disponível.');return found;};
    const ids=new Set<string>();
    const items:CustomMealSelection[]=input.items.map((raw:unknown)=>{
      const i=object(raw);
      if(typeof i.tempId!=='string'||! /^[a-zA-Z0-9-]{1,80}$/.test(i.tempId)||ids.has(i.tempId))throw new ApiError('Combinação inválida.');ids.add(i.tempId);
      const specialInstructions=i.specialInstructions===undefined?'':text(i.specialInstructions,500);
      if(i.type==='complete_dish'){const dish=lookup(i.completeDish,'complete_dish');return {tempId:i.tempId,type:i.type,completeDish:dish,name:dish.name,quantity:i.quantity,specialInstructions};}
      if(i.type!=='custom')throw new ApiError('Tipo de marmita inválido.');
      const base=lookup(i.base,'base'),protein=lookup(i.protein,'protein'),side1=lookup(i.side1,'side'),side2=lookup(i.side2,'side');
      if(side1.id===side2.id)throw new ApiError('Selecione dois acompanhamentos diferentes.');
      return {tempId:i.tempId,type:i.type,name:protein.name+' com '+base.name,base,protein,side1,side2,quantity:i.quantity,specialInstructions};
    });
    const deliveries:DeliveryPlan[]=input.deliveries.map((raw:unknown)=>{const p=object(raw);return {id:crypto.randomUUID(),date:text(p.date,10,true),quantities:object(p.quantities),period:period(p.period) as DeliveryPlan['period']};});
    const error=validatePlan(items,deliveries,await availability());if(error)throw new ApiError(error);
    const quantity=items.reduce((n,i)=>n+i.quantity,0);if(quantity>10000)throw new ApiError('Máximo de 10.000 unidades por pedido.');
    if(typeof input.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId))throw new ApiError('Identificador inválido.');
    const id=input.requestId;
    const order:Order={id,user_id:user.id,status:'pending',order_type:deliveries.length>1?'package':'single',total_amount:calculateVolumePrice(quantity).totalPrice,quantity_meals:quantity,delivery_date:deliveries[0].date,delivery_shift:profile.preferred_delivery_period||null,payment_method:'pix',created_at:new Date().toISOString(),deliveries,profile,shipping_address_snapshot:{recipient_name:profile.full_name,recipient_phone:profile.phone,cep:profile.cep,street:profile.street,number:profile.number,neighborhood:profile.neighborhood,city:profile.city,state:profile.state,complement:profile.complement},items:items.map(i=>({id:i.tempId,order_id:id,item_type:i.type,name:i.name,base:i.base,protein:i.protein,side1:i.side1,side2:i.side2,complete_dish:i.completeDish,quantity:i.quantity,special_instructions:i.specialInstructions,created_at:new Date().toISOString()}))};
    const {data:saved,error:insertError}=await db.rpc('create_purchase',{owner_id:user.id,purchase_id:id,total_cents:Math.round(order.total_amount*100),order_payload:protect(order,user.id)});
    if(insertError)throw new ApiError('Não foi possível salvar o pedido.');return NextResponse.json({order:reveal(saved,user.id)},{status:201});
  }catch(e){return failure(e);}
}
