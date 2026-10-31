import 'server-only';
import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import type {NextRequest} from 'next/server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ApiError} from './errors';
export function clientAddress(req:NextRequest){
 // Only trust headers overwritten by the configured hosting platform, never arbitrary X-Forwarded-For.
 const source=process.env.TRUSTED_PROXY;
 const candidate=source==='vercel'&&process.env.VERCEL?req.headers.get('x-vercel-forwarded-for'):source==='netlify'&&process.env.NETLIFY?req.headers.get('x-nf-client-connection-ip'):null;
 return candidate&&isIP(candidate.trim())?candidate.trim():'unverified-origin';
}
export async function rateLimit(db:SupabaseClient,scope:string,identity:string,limit:number,seconds:number){
 const secret=process.env.RATE_LIMIT_SECRET;if(!secret||secret.length<32)throw new ApiError('Proteção de acesso não configurada.',503);
 const bucket=createHmac('sha256',secret).update(scope+':'+identity).digest('hex');
 const {data,error}=await db.rpc('consume_api_limit',{bucket,max_hits:limit,window_seconds:seconds});
 if(error)throw new ApiError('Não foi possível verificar o limite de acesso. Tente novamente.',503);
 if(typeof data!=='number')throw new ApiError('Serviço temporariamente indisponível.',503);
 if(data>0)throw new ApiError('Muitas tentativas. Aguarde alguns minutos e tente novamente.',429,data);
}
