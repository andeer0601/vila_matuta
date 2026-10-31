import {DEMO_MODE} from './mode';
export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export async function fetchAddressByCEP(rawCep: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
} | null> {
  if(DEMO_MODE)return {street:'Rua de Demonstração',neighborhood:'Bairro de Teste',city:'São Paulo',state:'SP',complement:''};
  const cleanCep = rawCep.replace(/\D/g, '');
  if (cleanCep.length !== 8) {
    return null;
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (!res.ok) return null;
    const data: ViaCEPResponse = await res.json();
    if (data.erro) return null;

    return {
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || 'SP',
      complement: data.complemento || '',
    };
  } catch (error) {
    console.error('Erro ao consultar ViaCEP:', error);
    return null;
  }
}
