import {NextRequest,NextResponse} from 'next/server';
import {body,customer,failure} from '@/lib/server/database';
import {ApiError,operationError} from '@/lib/server/errors';
import {address,period,profileEdits,text,uuid} from '@/lib/server/input';
import {protect,reveal} from '@/lib/server/privacy';
import type {SupabaseClient} from '@supabase/supabase-js';
async function matchingAddress(db:SupabaseClient,owner:string,a:Record<string,string>){const {data,error}=await db.from('saved_addresses').select('id,address').eq('user_id',owner);if(error)throw new ApiError('Não foi possível consultar endereços.',503);return data?.find(row=>{const plain=reveal(row.address,owner);return Object.keys(a).every(k=>(plain[k]||'')===a[k]);})?.id||null;}
export async function GET(req:NextRequest){try{const {db,user,profile}=await customer(req);const {data,error}=await db.from('saved_addresses').select('*').eq('user_id',user.id).order('created_at');if(error)throw new ApiError('Não foi possível carregar endereços.');return NextResponse.json({profile,addresses:data.map(row=>({...row,address:reveal(row.address,user.id)}))},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{
 const input=await body(req);const {db,user,profile}=await customer(req);
 if(input.action==='address'){
 const a=input.address?address(input.address):null;
 const existing=input.addressId?uuid(input.addressId):a?await matchingAddress(db,user.id,a):null;
 const {data,error}=await db.rpc('save_customer_address',{owner_id:user.id,address_data:a?protect(a,user.id):null,address_id:existing,make_primary:input.makePrimary===true,purchase_id:input.orderId?uuid(input.orderId):null,plan_id:input.planId?text(input.planId,80,true):null,period:period(input.period)});
 if(error)throw operationError(error.message);return NextResponse.json({id:data});
 }
 if(input.action!=='profile')throw new ApiError('Ação inválida.');
 const edits=profileEdits(input.profile);const merged={...profile,...edits};
 if(edits.onboarding_completed===true&&(!merged.full_name?.trim()||!merged.phone?.trim()||!merged.street?.trim()||!merged.number?.trim()||!merged.city?.trim()))throw new ApiError('Complete nome, telefone e endereço.');
 const addressKeys=['cep','street','number','neighborhood','complement','city','state'];
 if(addressKeys.some(k=>k in edits)){
 const a=address({...Object.fromEntries(addressKeys.map(k=>[k,merged[k]||''])),recipient_name:merged.full_name||'',recipient_phone:merged.phone||''});
 const existing=await matchingAddress(db,user.id,a);
 const {error}=await db.rpc('save_customer_address',{owner_id:user.id,address_data:protect(a,user.id),address_id:existing,make_primary:true});if(error)throw operationError(error.message);
 }
 for(const key of addressKeys)delete edits[key];
 const {data,error}=await db.from('profiles').update(protect(edits,user.id)).eq('id',user.id).select('*').single();if(error)throw new ApiError('Não foi possível salvar o perfil.');return NextResponse.json({profile:{...reveal(data,user.id),email:user.email||''}});
}catch(e){return failure(e);}}
