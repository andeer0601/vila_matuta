import {uuid,text} from '@/lib/server/input';
import {clientAddress,rateLimit} from '@/lib/server/rate-limit';
import {ApiError,operationError} from '@/lib/server/errors';
import {NextRequest,NextResponse} from 'next/server';

import {body,customer,database,failure} from '@/lib/server/database';

export async function GET(req:NextRequest){try{const db=database();await rateLimit(db,'settings',clientAddress(req),120,60);const admin=req.headers.has('authorization')?(await customer(req)).profile.role==='admin':false;const [{data:settings,error:a},{data:closures,error:b},{data:limits,error:c}]=await Promise.all([db.from('shop_settings').select('whatsapp').single(),db.from('production_closures').select('production_date,reason'),db.from('production_limits').select('production_date,capacity')]);if(a||b||c)throw new ApiError('Não foi possível carregar a configuração.');return NextResponse.json({whatsapp:settings?.whatsapp||'',capacity_limits:Object.fromEntries((limits||[]).map(l=>[l.production_date,l.capacity])),closures:(closures||[]).map(c=>({...c,reason:admin?c.reason:''}))});}catch(e){return failure(e);}}

export async function POST(req:NextRequest){try{const {db,user,profile}=await customer(req);if(profile.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:403});const input=await body(req);

 if(input.action==='whatsapp'){const whatsapp=text(input.whatsapp??'',30).replace(/\D/g,'');if(whatsapp&&!/^[0-9]{10,15}$/.test(whatsapp))throw new ApiError('Informe DDI, DDD e telefone.');const {error}=await db.from('shop_settings').update({whatsapp}).eq('id',true);if(error)throw new ApiError('Não foi possível salvar.');}

 else if(input.action==='capacity'){if(input.limit!==null&&(typeof input.limit!=='number'||!Number.isInteger(input.limit)||input.limit<2||input.limit>10000))throw new ApiError('Informe uma capacidade inteira entre 2 e 10.000.');const {error}=await db.rpc('set_production_capacity',{actor_id:user.id,day:text(input.date,10,true),new_capacity:input.limit});if(error)throw operationError(error.message);}
 else if(input.action==='closure'){const {error}=await db.rpc('set_production_closure',{actor_id:user.id,day:text(input.date,10,true),closed:input.closed===true,reason:text(input.reason??'',200)});if(error)throw operationError(error.message);}

 else if(input.action==='move'){const {error}=await db.rpc('move_production',{actor_id:user.id,purchase_id:uuid(input.orderId),plan_id:text(input.planId,80,true),new_date:text(input.date,10,true)});if(error)throw operationError(error.message);}
 else if(input.action==='status'){const {error}=await db.rpc('set_delivery_status',{actor_id:user.id,purchase_id:uuid(input.orderId),plan_id:text(input.planId,80,true),new_status:text(input.status,20,true)});if(error)throw operationError(error.message);}

 else throw new ApiError('Ação inválida.');return NextResponse.json({success:true});}catch(e){return failure(e);}}
