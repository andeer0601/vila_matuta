import {NextRequest,NextResponse} from 'next/server';
import {body,customer,failure} from '@/lib/server/database';
import {ApiError} from '@/lib/server/errors';
import {uuid} from '@/lib/server/input';
import {reveal} from '@/lib/server/privacy';
export async function GET(req:NextRequest){try{
 const {db,profile}=await customer(req);if(profile.role!=='admin')throw new ApiError('Acesso restrito.',403);
 const {data,error}=await db.from('profiles').select('id,full_name,role,disabled_at').order('created_at');
 if(error)throw new ApiError('Não foi possível carregar usuários.',503);
 return NextResponse.json({users:data.map(p=>reveal(p,p.id))},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{
 const {db,user,profile}=await customer(req);if(profile.role!=='admin')throw new ApiError('Acesso restrito.',403);
 const input=await body(req);if(typeof input.disabled!=='boolean')throw new ApiError('Ação inválida.');
 const {error}=await db.rpc('set_user_access',{actor_id:user.id,target_id:uuid(input.targetId),disabled:input.disabled});
 if(error)throw new ApiError('Não foi possível alterar o acesso. Não é permitido alterar a própria conta.',409);
 return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
