import 'server-only';
import {DEMO_MODE} from '../mode';
import {ApiError} from './errors';
import {reveal} from './privacy';
import {clientAddress,rateLimit} from './rate-limit';
import {object} from './input';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
export function database() {
  if(DEMO_MODE)throw new ApiError('Integrações reais desativadas nesta demonstração.',403);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new ApiError('O serviço ainda não está configurado.',503);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function customer(req:NextRequest) {
  const token=req.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token||token.length>8192)throw new ApiError('Entre na sua conta.',401);
  const db=database();await rateLimit(db,'api-ip',clientAddress(req),240,60);const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)throw new ApiError('Entre na sua conta.',401);
  await rateLimit(db,req.method==='GET'?'api-read':'api-write',user.id,req.method==='GET'?120:40,60);
  const {data:profile}=await db.from('profiles').select('*').eq('id',user.id).single();
  if(!profile)throw new ApiError('Entre na sua conta.',401);
  return {db,user,profile:{...reveal(profile,user.id),email:user.email||''}};
}
export async function body(req:NextRequest,webhook=false) {
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError('Envie dados JSON.',415);
  if(!webhook){const origin=req.headers.get('origin');const expected=process.env.APP_URL?new URL(process.env.APP_URL).origin:req.nextUrl.origin;if(origin&&origin!==expected)throw new ApiError('Origem não permitida.',403);}
  if(Number(req.headers.get('content-length')||0)>100000)throw new ApiError('Pedido muito grande.',413);
  const reader=req.body?.getReader();if(!reader)throw new ApiError('Dados inválidos.');const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>100000){await reader.cancel();throw new ApiError('Pedido muito grande.',413);}chunks.push(value);}
  let parsed:unknown;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApiError('Dados inválidos.');}return object(parsed);
}
export function failure(error:unknown) {
 const expected=error instanceof ApiError;const status=expected?error.status:500;
 return NextResponse.json({error:expected?error.message:'Não foi possível concluir a operação. Tente novamente ou fale com a equipe.'},{status,headers:{'Cache-Control':'no-store',...(expected&&error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}});
}
export async function availability() {
  const {data,error}=await database().from('production_capacity').select('delivery_date,quantity');
  if(error)throw new ApiError('Não foi possível consultar a produção.');
  const capacity:Record<string,number>={};for(const r of data||[])capacity[r.delivery_date]=(capacity[r.delivery_date]||0)+r.quantity;
  const {data:closures,error:closureError}=await database().from('production_closures').select('production_date');
  if(closureError)throw new ApiError('Não foi possível consultar o calendário.');
  for(const day of closures||[])capacity[day.production_date]=120;
  return capacity;
}
