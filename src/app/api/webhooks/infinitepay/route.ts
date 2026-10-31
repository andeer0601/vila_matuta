import {uuid} from '@/lib/server/input';
import {clientAddress,rateLimit} from '@/lib/server/rate-limit';
import { NextRequest,NextResponse } from 'next/server';
import { body,database,failure } from '@/lib/server/database';
import { verifyInfinitePayPayment } from '@/lib/infinitepay';
export async function POST(req:NextRequest) {
  try{
    const input=await body(req,true);
    for(const key of ['order_nsu','transaction_nsu','invoice_slug'])if(typeof input[key]!=='string'||input[key].length>200)return NextResponse.json({error:'Evento inválido.'},{status:400});
    uuid(input.order_nsu);const db=database();await rateLimit(db,'payment-webhook',clientAddress(req),300,60);const {data:order,error:readError}=await db.from('meal_purchases').select('id,total_cents').eq('id',input.order_nsu).single();
    if(readError&&readError.code!=='PGRST116')throw new Error('Consulta indisponível');
    if(!order)return NextResponse.json({error:'Pedido inválido.'},{status:400});
    const verified=await verifyInfinitePayPayment(order.id,input.transaction_nsu,input.invoice_slug);
    if(verified.success!==true||verified.paid!==true||verified.amount!==order.total_cents)return NextResponse.json({error:'Pagamento não confirmado.'},{status:400});
    const {error}=await db.rpc('confirm_purchase_payment',{purchase_id:order.id,transaction_id:input.transaction_nsu,amount_cents:verified.amount});
    if(error)return NextResponse.json({error:'Confirmação pendente. Tente novamente.'},{status:503});
    return NextResponse.json({success:true});
  }catch(error){return failure(error);}
}
