 'use client';
import {useEffect,useRef,useState} from 'react';
type Turnstile={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
declare global{interface Window{turnstile?:Turnstile}}
export function Captcha({onToken,resetKey}:{onToken:(token:string)=>void;resetKey:number}){
 const root=useRef<HTMLDivElement>(null);const callback=useRef(onToken);callback.current=onToken;const [error,setError]=useState('');const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
 useEffect(()=>{if(!key)return;let widget:string|undefined;let disposed=false;
 const render=()=>{if(disposed||!root.current||!window.turnstile)return;widget=window.turnstile.render(root.current,{sitekey:key,callback:(token:string)=>callback.current(token),'expired-callback':()=>callback.current(''),'error-callback':()=>{callback.current('');setError('Não foi possível carregar a verificação. Recarregue a página.');},theme:'light'});};
 let script=document.querySelector<HTMLScriptElement>('script[data-vm-turnstile]');if(window.turnstile)render();else if(script)script.addEventListener('load',render);else{script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.dataset.vmTurnstile='true';script.nonce=document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content||'';script.addEventListener('load',render);script.addEventListener('error',()=>setError('Não foi possível carregar a verificação.'));document.head.appendChild(script);}
 return()=>{disposed=true;script?.removeEventListener('load',render);if(widget)window.turnstile?.remove(widget);};
 },[key,resetKey]);
 return key?<div><div ref={root}/>{error&&<p role="alert" className="notice">{error}</p>}</div>:null;
}
