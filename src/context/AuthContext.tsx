'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile,Order } from '@/types/database';
import { DEMO_PROFILES } from '@/lib/supabase/mock-data';
import { DEMO_MODE } from '@/lib/mode';
import {todayInSaoPaulo} from '@/lib/scheduling';
import { api } from '@/lib/api';
import {readLocal,writeLocal,saveAddress,profileAddress,ORDER_STORAGE} from '@/lib/operations';
import { createClient } from '@/lib/supabase/client';
interface AuthState {
  user: Profile | null; role: 'admin'|'customer'; isLoading: boolean;
  loginAs: (type:'customer'|'admin'|'customer2')=>void;
  updateProfile: (data:Partial<Profile>)=>Promise<void>; logout:()=>void;
}
const AuthContext = createContext<AuthState>({user:null,role:'customer',isLoading:true,loginAs:()=>{},updateProfile:async()=>{},logout:()=>{}});
export function AuthProvider({children}:{children:React.ReactNode}) {
  const [user,setUser] = useState<Profile|null>(null);
  const [isLoading,setLoading] = useState(true);
  useEffect(()=>{
    if(DEMO_MODE) {
      const id=readLocal<string>('vm_demo_session', 'signed-out');if(id==='signed-out'){setLoading(false);return;}
      const p=readLocal<Record<string,Profile>>('vm_profiles',{})[id]||DEMO_PROFILES[id];setUser(p&&!p.disabled_at?p:null); setLoading(false); return;
    }
    if(!process.env.NEXT_PUBLIC_SUPABASE_URL) {setLoading(false);return;}
    const supabase=createClient();
    const load=async()=>{
      const {data:{user:authUser}}=await supabase.auth.getUser();
      if(authUser){try{const data=await api('/api/account');setUser(data.profile);}catch{setUser(null);}}
      else setUser(null); setLoading(false);
    };
    void load();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void load(),0);});
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!user)return;
    let active=true;
    const sync=()=>{
      if(DEMO_MODE){const id=readLocal<string>('vm_demo_session','signed-out');const p=readLocal<Record<string,Profile>>('vm_profiles',{})[id]||DEMO_PROFILES[id];setUser(p&&!p.disabled_at?p:null);}
      else void api('/api/account').then(data=>{if(active)setUser(data.profile);}).catch(()=>{if(active)setUser(null);});
    };
    window.addEventListener('storage',sync);window.addEventListener('vm-update',sync);window.addEventListener('focus',sync);
    const timer=setInterval(sync,30000);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('storage',sync);window.removeEventListener('vm-update',sync);window.removeEventListener('focus',sync);};
  },[user?.id]);
  const loginAs:AuthState['loginAs']=(type)=>{
    if(!DEMO_MODE)return;
    const id=type==='admin'?'user-admin':type==='customer2'?'user-customer-2':'user-customer-1';
    const profile=readLocal<Record<string,Profile>>('vm_profiles',{})[id]||DEMO_PROFILES[id];if(profile.disabled_at)throw new Error('Acesso desativado. Fale com a administração.');setUser(profile);writeLocal('vm_demo_session',id);
  };
  const updateProfile:AuthState['updateProfile']=async(data)=>{
    if(!user) throw new Error('Entre na sua conta.');
    const {role,id,email,created_at,disabled_at,...editable}=data;
    if(!DEMO_MODE){const result=await api('/api/account',{action:'profile',profile:editable});setUser(result.profile);return;}
    if(editable.street)await saveAddress(user,{address:profileAddress({...user,...editable}),makePrimary:true});
    const next={...(readLocal<Record<string,Profile>>('vm_profiles',{})[user.id]||user),...editable};writeLocal('vm_profiles',{...readLocal<Record<string,Profile>>('vm_profiles',{}),[user.id]:next});setUser(next);
    if(editable.preferred_delivery_period!==undefined){const orders=readLocal<Order[]>(ORDER_STORAGE,[]);for(const o of orders.filter(o=>o.user_id===user.id))for(const p of o.deliveries||[])if(p.date>todayInSaoPaulo()&&!['in_delivery','delivered'].includes(p.status||''))p.preferred_period=editable.preferred_delivery_period;writeLocal(ORDER_STORAGE,orders);}
  };
  const logout=()=>{setUser(null);if(DEMO_MODE)writeLocal('vm_demo_session','signed-out');else void createClient().auth.signOut();};
  return <AuthContext.Provider value={{user,role:user?.role||'customer',isLoading,loginAs,updateProfile,logout}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
