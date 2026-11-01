import {uuid} from '@/lib/server/input';
import {ApiError,operationError} from '@/lib/server/errors';
import {NextRequest,NextResponse} from 'next/server';

import {body,customer,failure} from '@/lib/server/database';

import {verifyInfinitePayPayment} from '@/lib/infinitepay';

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;uuid(id);const {db,user}=await customer(req);const input=await body(req);if(![input.transaction,input.slug].every(v=>typeof v==='string'&&v.length>0&&v.length<=200))throw new ApiError('Referência do pagamento inválida.');const {data:order}=await db.from('meal_purchases').select('total_cents,status').eq('id',id).eq('user_id',user.id).single();if(!order||order.status==='cancelled')throw new ApiError('Pedido indisponível.');if(order.status!=='pending')return NextResponse.json({paid:true});const payment=await verifyInfinitePayPayment(id,input.transaction,input.slug);if(!payment.success||!payment.paid)return NextResponse.json({paid:false});if(payment.amount!==order.total_cents)throw new ApiError('Valor do pagamento divergente.');const {error}=await db.rpc('confirm_purchase_payment',{purchase_id:id,transaction_id:input.transaction,amount_cents:payment.amount});if(error)throw new ApiError('Não foi possível confirmar o pagamento. Fale com a equipe.');return NextResponse.json({paid:true});}catch(e){return failure(e);}}
