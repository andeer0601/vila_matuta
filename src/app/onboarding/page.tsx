'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Search,
  Sparkles,
  Phone,
  Home,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import {DEMO_MODE} from '@/lib/mode';
import {ShiftName} from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import { fetchAddressByCEP } from '@/lib/viacep';
import { formatBrazilianPhone, formatBrazilianCEP } from '@/lib/rules';

const DIETARY_TAG_OPTIONS = [
  'Sem Lactose',
  'Sem Glúten',
  'Diabético',
  'Sem Coentro',
  'Sem Frutos do Mar',
  'Sem Açúcar',
  'Vegetariano',
  'Vegano',
  'Hipertenso (Pouco Sal)',
  'Sem Pimenta',
  'Sem Amendoim / Castanhas',
  'Sem Ovos',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, updateProfile, isLoading } = useAuth();

  const cepRequest=useRef(0);
  const [period,setPeriod]=useState<ShiftName|''>(user?.preferred_delivery_period||'');
  const [saveError,setSaveError] = useState('');
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  // Step 1: Personal Data
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Step 2: Delivery Address
  const [cep, setCep] = useState(user?.cep || '');
  const [street, setStreet] = useState(user?.street || '');
  const [number, setNumber] = useState(user?.number || '');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood || '');
  const [complement, setComplement] = useState(user?.complement || '');
  const [city, setCity] = useState(user?.city || 'São Paulo');
  const [state, setState] = useState(user?.state || 'SP');

  // Step 3: Dietary Restrictions
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>(
    user?.dietary_restrictions || []
  );
  const [dietaryNotes, setDietaryNotes] = useState(user?.dietary_notes || '');

  useEffect(() => {
    if (!user) return;
    setPeriod(user.preferred_delivery_period||'');
    setFullName(user.full_name || ''); setPhone(user.phone || ''); setCep(user.cep || '');
    setStreet(user.street || ''); setNumber(user.number || ''); setNeighborhood(user.neighborhood || '');
    setComplement(user.complement || ''); setCity(user.city || ''); setState(user.state || 'SP');
    setSelectedRestrictions(user.dietary_restrictions || []); setDietaryNotes(user.dietary_notes || '');
  }, [user?.id]);

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const request=++cepRequest.current;
    const formatted = formatBrazilianCEP(e.target.value);
    setCep(formatted);
    setCepError('');setIsSearchingCep(false);

    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsSearchingCep(true);
      const res = await fetchAddressByCEP(clean);
      if(request!==cepRequest.current)return;
      setIsSearchingCep(false);

      if (res) {
        setStreet(res.street);
        setNeighborhood(res.neighborhood);
        setCity(res.city);
        setState(res.state);
        if (res.complement && !complement) setComplement(res.complement);
      } else {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
      }
    }
  };

  const toggleRestriction = (tag: string) => {
    if (selectedRestrictions.includes(tag)) {
      setSelectedRestrictions(selectedRestrictions.filter((t) => t !== tag));
    } else {
      setSelectedRestrictions([...selectedRestrictions, tag]);
    }
  };

  const handleFinish = async () => {
    setSaveError('');
    if (!fullName.trim() || phone.replace(/\D/g,'').length < 10 || !street.trim() || !number.trim() || !city.trim()) { setSaveError('Preencha nome, telefone e endereço para continuar.'); return; }
    setIsSaving(true);
    try { await updateProfile({
      preferred_delivery_period:period||null,
      full_name: fullName,
      phone,
      cep,
      street,
      number,
      neighborhood,
      complement,
      city,
      state,
      dietary_restrictions: selectedRestrictions,
      dietary_notes: dietaryNotes,
      onboarding_completed: true,
    });
    setIsSaving(false);
    router.push('/monte-sua-marmita');
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar.'); } finally { setIsSaving(false); }
  };

  if(isLoading)return <p role="status" className="p-8">Carregando perfil.</p>;
  if(!user)return <section className="max-w-xl mx-auto p-8 space-y-4"><h1 className="text-3xl font-bold">Seu perfil</h1><p>Entre para editar suas informações.</p><Link className="button-primary" href="/entrar?next=/onboarding">Entrar</Link></section>;
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {DEMO_MODE&&<p className="notice mb-5">Perfil fictício: use apenas dados inventados. A consulta de CEP também é simulada.</p>}
      {saveError && <p role="alert" className="notice mb-5">{saveError}</p>}
      <div className="rustic-card p-5 mb-5 space-y-3"><label className="block text-sm font-bold">Melhor período para receber<select className="field mt-2" value={period} onChange={e=>setPeriod(e.target.value as ShiftName|'')}><option value="">Sem preferência</option>{['Manhã','Tarde','Noite'].map(p=><option key={p}>{p}</option>)}</select></label><p className="text-xs text-stone-500">Você pode escolher outro período para cada entrega. Sujeito à organização da rota.</p><Link className="underline text-sm" href="/enderecos">Escolher entre meus endereços salvos</Link></div>
      {/* Header Wizard */}
      <div className="text-center space-y-2 mb-8">
        <span className="text-xs font-bold uppercase tracking-wider text-[#B94B0B] bg-[#FFF7ED] px-3 py-1 rounded-full border border-[#FED7AA]">
          Boas-vindas à Vila Matuta
        </span>
        <h1 className="text-3xl font-bold font-serif text-[#5C4033]">
          Complete seu Perfil de Entrega
        </h1>
        <p className="text-xs sm:text-sm text-[#8B5A2B]">
          Informe suas preferências para orientar o atendimento. Restrições alimentares precisam ser confirmadas com a equipe antes de uma compra real.
        </p>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#EDE0D4] w-full -z-0"></div>
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#B94B0B] transition-all duration-300 -z-0"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        ></div>

        <div className="flex flex-col items-center gap-1 z-10">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
              step >= 1
                ? 'bg-[#B94B0B] text-white ring-4 ring-[#FFF7ED]'
                : 'bg-white text-[#8B5A2B] border border-[#DDB892]'
            }`}
          >
            1
          </div>
          <span className="text-xs font-bold text-[#5C4033]">Dados Pessoais</span>
        </div>

        <div className="flex flex-col items-center gap-1 z-10">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
              step >= 2
                ? 'bg-[#B94B0B] text-white ring-4 ring-[#FFF7ED]'
                : 'bg-white text-[#8B5A2B] border border-[#DDB892]'
            }`}
          >
            2
          </div>
          <span className="text-xs font-bold text-[#5C4033]">Endereço</span>
        </div>

        <div className="flex flex-col items-center gap-1 z-10">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
              step >= 3
                ? 'bg-[#B94B0B] text-white ring-4 ring-[#FFF7ED]'
                : 'bg-white text-[#8B5A2B] border border-[#DDB892]'
            }`}
          >
            3
          </div>
          <span className="text-xs font-bold text-[#5C4033]">Restrições</span>
        </div>
      </div>

      {/* Main Step Card */}
      <div className="rustic-card p-6 sm:p-8 bg-white border border-[#EDE0D4] shadow-md">
        {/* STEP 1: DADOS PESSOAIS */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F0EB]">
              <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] text-[#B94B0B] flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#5C4033] font-serif">Passo 1: Dados Pessoais</h3>
                <p className="text-xs text-[#8B5A2B]">Como podemos te chamar e confirmar suas entregas?</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  aria-label="Nome completo" autoComplete="name" maxLength={120} value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Mariana Silva"
                  className="w-full px-4 py-3 rounded-xl border border-[#DDB892] focus:ring-2 focus:ring-[#B94B0B] focus:border-transparent outline-none text-sm text-[#27170E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                  WhatsApp / Celular (com DDD) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    aria-label="WhatsApp / Celular (com DDD)" autoComplete="tel"  value={phone}
                    onChange={(e) => setPhone(formatBrazilianPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    className="w-full px-4 py-3 rounded-xl border border-[#DDB892] focus:ring-2 focus:ring-[#B94B0B] focus:border-transparent outline-none text-sm text-[#27170E]"
                  />
                  <Phone className="w-4 h-4 text-[#8B5A2B] absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <span className="text-xs text-[#8B5A2B] mt-1 block">
                  Telefone para contato sobre o pedido. Não enviamos mensagens automaticamente.
                </span>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                disabled={!fullName.trim() || phone.replace(/\D/g, '').length < 10}
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-[#B94B0B] hover:bg-[#963B08] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow transition flex items-center gap-2"
              >
                Continuar para Endereço
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: ENDEREÇO DE ENTREGA */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F0EB]">
              <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] text-[#B94B0B] flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#5C4033] font-serif">Passo 2: Endereço de Entrega</h3>
                <p className="text-xs text-[#8B5A2B]">Para onde devemos enviar suas marmitas fresquinhas?</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                  CEP (Busca Automática) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    aria-label="CEP" autoComplete="postal-code"  value={cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full px-4 py-3 rounded-xl border border-[#DDB892] focus:ring-2 focus:ring-[#B94B0B] focus:border-transparent outline-none text-sm text-[#27170E]"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {isSearchingCep ? (
                      <span className="text-xs text-[#B94B0B] font-semibold animate-pulse">Buscando...</span>
                    ) : (
                      <Search className="w-4 h-4 text-[#8B5A2B]" />
                    )}
                  </div>
                </div>
                {cepError && <span className="text-xs text-red-600 mt-1 block">{cepError}</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                    Rua / Avenida *
                  </label>
                  <input
                    type="text"
                    aria-label="Rua / Avenida" autoComplete="address-line1" maxLength={200} value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Ex: Rua Joaquim Floriano"
                    className="w-full px-4 py-3 rounded-xl border border-[#DDB892] focus:ring-2 focus:ring-[#B94B0B] focus:border-transparent outline-none text-sm text-[#27170E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                    Número *
                  </label>
                  <input
                    type="text"
                    aria-label="Número" autoComplete="off" maxLength={20} value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Ex: 466"
                    className="w-full px-4 py-3 rounded-xl border border-[#DDB892] focus:ring-2 focus:ring-[#B94B0B] focus:border-transparent outline-none text-sm text-[#27170E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    aria-label="Bairro" autoComplete="address-level3" maxLength={100} value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Ex: Itaim Bibi"
                    className="w-full px-4 py-3 rounded-xl border border-[#DDB892] focus:ring-2 focus:ring-[#B94B0B] focus:border-transparent outline-none text-sm text-[#27170E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                    Complemento
                  </label>
                  <input
                    type="text"
                    aria-label="Complemento" autoComplete="address-line2" maxLength={200} value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Ex: Bloco B Apto 12"
                    className="w-full px-4 py-3 rounded-xl border border-[#DDB892] focus:ring-2 focus:ring-[#B94B0B] focus:border-transparent outline-none text-sm text-[#27170E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    aria-label="Cidade" maxLength={100} autoComplete="address-level2"
                    value={city} onChange={e=>setCity(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#DDB892] text-sm text-[#5C4033]"
                  />
                </div>
              </div>
            </div>

            <label className="block text-sm font-bold">UF<input className="field mt-2" value={state} maxLength={2} onChange={e=>setState(e.target.value.toUpperCase())}/></label>
            <div className="pt-4 flex flex-wrap gap-3 justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3 bg-[#F5F0EB] hover:bg-[#EDE0D4] text-[#5C4033] font-bold text-sm rounded-xl transition flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                type="button"
                disabled={!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !/^[A-Z]{2}$/.test(state) || cep.replace(/\D/g,'').length!==8}
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-[#B94B0B] hover:bg-[#963B08] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow transition flex items-center gap-2"
              >
                Continuar para Restrições
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESTRIÇÕES ALIMENTARES */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F0EB]">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#5C4033] font-serif">
                  Passo 3: Restrições & Preferências Alimentares
                </h3>
                <p className="text-xs text-[#8B5A2B]">
                  As preferências aparecem para a equipe da cozinha.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-2">
                  Selecione as Restrições / Alergias aplicáveis:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {DIETARY_TAG_OPTIONS.map((tag) => {
                    const isSelected = selectedRestrictions.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleRestriction(tag)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition flex items-center justify-between border ${
                          isSelected
                            ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-200'
                            : 'bg-[#FDFBF7] text-[#5C4033] border-[#EDE0D4] hover:bg-[#F5F0EB]'
                        }`}
                      >
                        <span>{tag}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-1.5">
                  Observações Extras para a Cozinha (Campo Livre)
                </label>
                <textarea
                  rows={3}
                  aria-label="Observações para a cozinha" autoComplete="off" maxLength={500} value={dietaryNotes}
                  onChange={(e) => setDietaryNotes(e.target.value)}
                  placeholder="Ex: Não gosto de molho apimentado, cozinhar os legumes bem macios, etc."
                  className="w-full px-4 py-3 rounded-xl border border-[#DDB892] focus:ring-2 focus:ring-[#B94B0B] focus:border-transparent outline-none text-sm text-[#27170E]"
                />
              </div>

              {/* Box de Prévia do Badge que aparecerá para o Cozinheiro */}
              {selectedRestrictions.length > 0 && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-red-800 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Prévia do Alerta para o Painel da Cozinha:
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedRestrictions.map((r) => (
                      <span
                        key={r}
                        className="px-2 py-0.5 rounded bg-red-600 text-white font-extrabold text-xs uppercase tracking-wider"
                      >
                        ⚠️ {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-3 bg-[#F5F0EB] hover:bg-[#EDE0D4] text-[#5C4033] font-bold text-sm rounded-xl transition flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinish}
                className="px-8 py-3.5 bg-[#B94B0B] hover:bg-[#963B08] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                {isSaving ? 'Salvando Perfil...' : 'Concluir & Montar Marmitas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
