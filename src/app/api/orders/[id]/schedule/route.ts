import {object,period,text,uuid} from '@/lib/server/input';
import {ApiError,operationError} from '@/lib/server/errors';
import { NextRequest,NextResponse } from 'next/server';
import { body,customer,failure } from '@/lib/server/database';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;uuid(id);
    const {db,user}=await customer(req);const input=await body(req);
    if(!Array.isArray(input.deliveries)||input.deliveries.length>200)throw new ApiError('Entregas inválidas.');
    const {data,error}=await db.rpc('schedule_purchase',{purchase_id:id,owner_id:user.id,new_plans:input.deliveries.map((raw:unknown)=>{const p=object(raw);return {date:text(p.date,10,true),quantities:object(p.quantities),period:period(p.period)};})});
    if(error)throw new ApiError('Não foi possível agendar: verifique datas, quantidades e disponibilidade.');
    return NextResponse.json({success:data});
  }catch(e){return failure(e);}
}
