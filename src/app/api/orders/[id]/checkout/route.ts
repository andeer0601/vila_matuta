import {uuid} from '@/lib/server/input';
import {ApiError,operationError} from '@/lib/server/errors';
import { NextRequest,NextResponse } from 'next/server';
import { customer,failure } from '@/lib/server/database';
import { createInfinitePayCharge } from '@/lib/infinitepay';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;uuid(id);
    const {db,user,profile}=await customer(req);
    const {data:order}=await db.from('meal_purchases').select('*').eq('id',id).eq('user_id',user.id).single();
    if(!order||order.status!=='pending')throw new ApiError('Pedido não disponível para pagamento.');
    if(process.env.PAYMENTS_ENABLED!=='true'||!process.env.INFINITEPAY_HANDLE||!process.env.APP_URL?.startsWith('https://'))throw new ApiError('O pagamento online ainda não está habilitado.');
    const {data:reservation,error:reserveError}=await db.rpc('reserve_checkout',{purchase_id:id,owner_id:user.id});
    if(reserveError)throw operationError(reserveError.message);
    if(reservation.url)return NextResponse.json(reservation);
    const url=await createInfinitePayCharge({...order.payload,total_amount:order.total_cents/100},{name:profile.full_name,email:user.email||''});
    const {error}=await db.from('meal_purchases').update({checkout_url:url}).eq('id',order.id).eq('status','pending');
    if(error)throw new ApiError('A geração do pagamento precisa de verificação pela equipe. Não crie outro pedido para pagar.');
    return NextResponse.json({url});
  }catch(e){return failure(e);}
}
