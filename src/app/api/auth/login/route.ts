import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {body,database,failure} from '@/lib/server/database';
import {ApiError} from '@/lib/server/errors';
import {text} from '@/lib/server/input';
import {clientAddress,rateLimit} from '@/lib/server/rate-limit';
export async function POST(req:NextRequest){try{
 const input=await body(req);const email=text(input.email,254,true).toLowerCase();if(typeof input.password!=='string'||input.password.length<1||input.password.length>1024)throw new ApiError('Confira seu e-mail e senha.');const password=input.password;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError('Confira seu e-mail e senha.');
 const db=database();await rateLimit(db,'login-ip',clientAddress(req),30,900);await rateLimit(db,'login-account',email,10,900);
 const captchaToken=input.captchaToken?text(input.captchaToken,4096,true):undefined;
 if(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&!captchaToken)throw new ApiError('Conclua a verificação de segurança.');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new ApiError('O acesso online ainda não foi configurado.',503);
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await auth.auth.signInWithPassword({email,password,options:{captchaToken}});
 if(error||!data.session)throw new ApiError('Não foi possível entrar. Confira seu e-mail, senha e a verificação de segurança.',401);
 const {data:profile,error:profileError}=await db.from('profiles').select('disabled_at,role').eq('id',data.user.id).single();
 if(profileError||!profile||profile.disabled_at){await auth.auth.signOut();throw new ApiError('Acesso indisponível. Fale com a administração.',403);}
 return NextResponse.json({access_token:data.session.access_token,refresh_token:data.session.refresh_token,role:profile.role},{headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
}catch(e){return failure(e);}}
