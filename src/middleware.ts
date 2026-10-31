import {NextRequest,NextResponse} from 'next/server';
import {DEMO_MODE} from './lib/mode';
export function middleware(req:NextRequest){
 const dev=process.env.NODE_ENV==='development';
 const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
 let supabase='';
 if(!DEMO_MODE)try{if(process.env.NEXT_PUBLIC_SUPABASE_URL)supabase=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;}catch{}
 const externalScripts=DEMO_MODE?'':'https://challenges.cloudflare.com';
 const connections=DEMO_MODE?'':`${supabase} https://viacep.com.br https://challenges.cloudflare.com`;
 const policy=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev?"'unsafe-eval'":''} ${externalScripts}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'",`connect-src 'self' ${connections} ${dev?'ws:':''}`,DEMO_MODE?"frame-src 'none'":"frame-src https://challenges.cloudflare.com","frame-ancestors 'none'","object-src 'none'","base-uri 'self'","form-action 'self'"].join('; ');
 const requestHeaders=new Headers(req.headers);
 requestHeaders.set('x-nonce',nonce);requestHeaders.set('Content-Security-Policy',policy);
 const blocked=DEMO_MODE&&(req.nextUrl.pathname==='/api'||req.nextUrl.pathname.startsWith('/api/'));
 const response=blocked
  ?NextResponse.json({error:'Integrações reais desativadas nesta demonstração.'},{status:403})
  :NextResponse.next({request:{headers:requestHeaders}});
 // Set the complete policy on early denials as well as rendered pages.
 response.headers.set('Content-Security-Policy',policy);
 response.headers.set('Cache-Control','no-store');
 response.headers.set('X-Content-Type-Options','nosniff');
 response.headers.set('X-Frame-Options','DENY');
 response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(!dev&&req.nextUrl.protocol==='https:')response.headers.set('Strict-Transport-Security','max-age=31536000');
 return response;
}
// API matching is unconditional: an image-like suffix never bypasses middleware.
export const config={matcher:['/api/:path*','/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)']};
