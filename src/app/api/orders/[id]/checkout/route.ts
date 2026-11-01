import {uuid} from '@/lib/server/input';
import {ApiError,operationError} from '@/lib/server/errors';
import {NextRequest,NextResponse} from 'next/server';
import {body,purchasingCustomer,failure} from '@/lib/server/database';
import {createInfinitePayCharge} from '@/lib/infinitepay';
import {paymentLinkState,validPaymentUrl} from '@/lib/payment-links';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const id=uuid((await params).id);const {db,user,profile}=await purchasingCustomer(req);
 const {data:order}=await db.from('meal_purchases').select('*').eq('id',id).eq('user_id',user.id).single();
 if(!order||order.status!=='pending')throw new ApiError('Pedido não disponível para pagamento.');
 const input=await body(req);if(!['create','retrieve'].includes(String(input.action)))throw new ApiError('Escolha uma ação de pagamento.');
 if(process.env.PAYMENTS_ENABLED!=='true'||!process.env.INFINITEPAY_HANDLE||!process.env.INFINITEPAY_API_KEY||!process.env.APP_URL?.startsWith('https://'))throw new ApiError('O pagamento online ainda não está habilitado.',503);
 const state=paymentLinkState(order);
 if(state==='expired'||state==='review')throw new ApiError('Este pagamento precisa de conferência pela equipe. Não será gerada outra cobrança.',409);
 if(input.action==='retrieve'&&state!=='ready')throw new ApiError('Este pedido ainda não possui link de pagamento.',409);
 const {data:reservation,error:reserveError}=await db.rpc('reserve_checkout',{purchase_id:id,owner_id:user.id});
 if(reserveError)throw operationError(reserveError.message);
 if(reservation.url){if(!validPaymentUrl(reservation.url))throw new ApiError('Link indisponível. Fale com a equipe.',409);return NextResponse.json({url:reservation.url,expires_at:order.checkout_expires_at},{headers:{'Cache-Control':'no-store'}});}
 if(input.action!=='create')throw new ApiError('Link indisponível. Fale com a equipe.',409);
 const expiresAt=reservation.expires_at;
 const url=await createInfinitePayCharge({...order.payload,id:order.id,total_amount:order.total_cents/100},{name:profile.full_name,email:user.email||''},expiresAt);
 const {error}=await db.from('meal_purchases').update({checkout_url:url,checkout_expires_at:expiresAt,checkout_single_payment:true}).eq('id',order.id).eq('status','pending');
 if(error)throw new ApiError('O pagamento precisa de conferência pela equipe. Não crie outro pedido para pagar.');
 return NextResponse.json({url,expires_at:expiresAt},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
