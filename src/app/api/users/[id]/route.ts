import {NextRequest,NextResponse} from 'next/server';
import {customer,failure} from '@/lib/server/database';
import {uuid} from '@/lib/server/input';
import {ApiError} from '@/lib/server/errors';
import {reveal} from '@/lib/server/privacy';
import {orderView} from '@/lib/server/order-view';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const {db,user,profile:viewer}=await customer(req);const raw=(await params).id;const id=raw==='me'?user.id:uuid(raw);
 if(viewer.role!=='admin'&&id!==user.id)throw new ApiError('Usuário indisponível.',404);
 const page=Number(req.nextUrl.searchParams.get('page')||0);if(!Number.isInteger(page)||page<0||page>100000)throw new ApiError('Página inválida.');
 const [profile,addresses,orders]=await Promise.all([
  db.from('profiles').select('*').eq('id',id).single(),
  db.from('saved_addresses').select('id,address').eq('user_id',id).order('created_at'),
  db.from('meal_purchases').select('*',{count:'exact'}).eq('user_id',id).order('created_at',{ascending:false}).order('id').range(page*25,page*25+24)
 ]);
 if(profile.error||!profile.data)throw new ApiError('Usuário indisponível.',404);
 if(addresses.error||orders.error)throw new ApiError('Não foi possível carregar o histórico.',503);
 const authUser=id===user.id?{data:{user}}:await db.auth.admin.getUserById(id);
 const plain=reveal(profile.data,id);
 return NextResponse.json({profile:{...plain,email:authUser.data.user?.email||''},addresses:addresses.data.map(a=>({...a,address:reveal(a.address,id)})),orders:orders.data.map(orderView),total:orders.count||0,hasMore:(page+1)*25<(orders.count||0)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
