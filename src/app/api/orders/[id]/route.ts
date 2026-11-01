import {NextRequest,NextResponse} from 'next/server';
import {customer,failure} from '@/lib/server/database';
import {uuid} from '@/lib/server/input';
import {ApiError} from '@/lib/server/errors';
import {orderView} from '@/lib/server/order-view';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const {db,user,profile}=await customer(req);const id=uuid((await params).id);
 let query=db.from('meal_purchases').select('*').eq('id',id);if(profile.role!=='admin')query=query.eq('user_id',user.id);
 const {data,error}=await query.single();if(error||!data)throw new ApiError('Pedido indisponível.',404);
 return NextResponse.json({order:orderView(data)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
