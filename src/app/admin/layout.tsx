'use client';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
export default function AdminLayout({children}:{children:React.ReactNode}){
 const {user,role,isLoading}=useAuth();
 if(isLoading)return <p className="p-8">Carregando…</p>;
 if(!user||role!=='admin')return <div className="max-w-xl mx-auto my-10 rustic-card p-8"><h1 className="font-bold text-2xl">Área da cozinha</h1><p className="my-4">Entre com uma conta de administrador para acessar a operação.</p><Link className="button-primary" href="/entrar">Entrar</Link></div>;
 return <>{children}</>;
}
