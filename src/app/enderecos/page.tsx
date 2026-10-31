 'use client';
import Link from 'next/link';
import {AddressBook} from '@/components/AddressBook';
export default function Addresses(){return <div className="max-w-2xl mx-auto px-5 py-10 space-y-6"><span className="eyebrow">SEUS LUGARES</span><h1 className="text-4xl font-bold">Endereços e preferências</h1><section className="rustic-card p-6"><AddressBook/></section><Link href="/onboarding" className="button-secondary">Editar dados pessoais e restrições</Link></div>;}
