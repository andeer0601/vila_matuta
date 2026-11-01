'use client';
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
export function RoleBoundary({children}:{children:React.ReactNode}){
 const {role,isLoading}=useAuth();const path=usePathname();const router=useRouter();
 const purchaseRoute=path==='/'||['/monte-sua-marmita','/meus-pedidos','/enderecos','/onboarding','/minha-conta','/checkout'].some(p=>path===p||path.startsWith(p+'/'));
 const blocked=role==='admin'&&purchaseRoute;
 useEffect(()=>{if(!isLoading&&blocked)router.replace('/admin');},[blocked,isLoading,router]);
 if((isLoading&&purchaseRoute)||blocked)return <p className="p-8" role="status">Carregando…</p>;
 return <>{children}</>;
}
