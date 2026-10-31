'use client';

import { DEMO_MODE } from '@/lib/mode';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Utensils, Calendar, ShoppingBag, ShieldCheck, User, Sparkles, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

export function Navbar() {
  const pathname = usePathname(); const router=useRouter();
  const { user, role, logout } = useAuth();
  const { totalMealsCount, creditsBalance } = useCart();


  return (
    <header className="sm:sticky top-0 z-50 bg-[#FDFBF7]/95 backdrop-blur border-b border-[#EDE0D4] shadow-sm">
      {DEMO_MODE && <div className="bg-[#5C4033] text-white text-xs py-2 px-4"><div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2"><span><strong>Demonstração</strong> · Dados fictícios · Sem cobranças reais</span><Link className="underline font-semibold py-1" href="/entrar">{user ? 'Trocar perfil' : 'Escolher perfil de teste'}</Link></div></div>}
      <div className="max-w-7xl mx-auto px-5 flex flex-wrap justify-end items-center gap-4 py-2 text-sm">{user ? <><span>{user.full_name} · {role==='admin'?'Administrador':'Cliente'}</span><Link href="/enderecos" className="underline">Meus endereços</Link><button onClick={()=>{logout();router.push('/entrar');}} className="underline">Sair</button></> : <Link href="/entrar" className="underline font-semibold">Entrar</Link>}</div>
      {/* Main Nav Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-[#B94B0B] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#5C4033] font-serif block">
                Vila Matuta
              </span>
              <span className="text-xs uppercase tracking-widest text-[#8B5A2B] font-semibold -mt-1 block">
                Marmitas Artesanais
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-1 lg:gap-2">
            <Link
              href="/monte-sua-marmita"
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                pathname === '/monte-sua-marmita'
                  ? 'bg-[#B94B0B] text-white shadow-sm'
                  : 'text-[#5C4033] hover:bg-[#F5F0EB]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Monte sua Marmita
            </Link>

            <Link
              href="/meus-pedidos"
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                pathname === '/meus-pedidos'
                  ? 'bg-[#B94B0B] text-white shadow-sm'
                  : 'text-[#5C4033] hover:bg-[#F5F0EB]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Pedidos & Entregas
            </Link>

            {role === 'admin' && (
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                  pathname.startsWith('/admin')
                    ? 'bg-[#5C4033] text-[#F5F0EB] shadow-sm'
                    : 'text-[#B94B0B] bg-[#FFF7ED] hover:bg-[#FFEDD5] border border-[#FED7AA]'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Administração
              </Link>
            )}
          </nav>

          {/* Right Action Icons & Badges */}
          <div className="flex items-center gap-3">
            {/* Saldo de Créditos Badge */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs uppercase font-bold text-[#8B5A2B] tracking-wider">Saldo Marmitas</span>
              <span className="text-sm font-extrabold text-[#B94B0B] bg-[#FFF7ED] px-2.5 py-0.5 rounded-full border border-[#FED7AA]">
                {creditsBalance} un
              </span>
            </div>

            {/* Cart Button */}
            <Link
              href="/monte-sua-marmita#carrinho"
              className="relative p-2.5 rounded-xl bg-[#F5F0EB] hover:bg-[#EDE0D4] text-[#5C4033] transition flex items-center justify-center"
              aria-label="Ver marmitas no pedido"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalMealsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#B94B0B] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                  {totalMealsCount}
                </span>
              )}
            </Link>

            {/* Onboarding / Profile shortcut */}
            <Link
              href={user ? "/onboarding" : "/entrar"}
              className="p-2.5 rounded-xl bg-[#F5F0EB] hover:bg-[#EDE0D4] text-[#5C4033] transition flex items-center justify-center"
              aria-label="Meu perfil e restrições"
            >
              <User className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
      <nav aria-label="Navegação móvel" className="lg:hidden flex justify-center gap-5 border-t py-3 text-sm font-semibold"><Link href="/monte-sua-marmita">Montar pedido</Link><Link href="/meus-pedidos">Minhas entregas</Link>{role === 'admin' && <Link href="/admin">Cozinha</Link>}</nav>
    </header>
  );
}
