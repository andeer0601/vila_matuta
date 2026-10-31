 'use client';
import {DEMO_MODE} from '@/lib/mode';
import {useEffect,useState} from 'react';
import {getSettings} from '@/lib/operations';
export function ContactSupport(){const [phone,setPhone]=useState('');useEffect(()=>{void getSettings().then(s=>setPhone(s.whatsapp)).catch(()=>{});},[]);if(DEMO_MODE)return <p className="notice">Atendimento simulado. Nenhuma mensagem será enviada. Troque para o perfil Anderson para testar a administração.</p>;return <p className="text-sm text-stone-600">Para alterações após o prazo, fale com a equipe. {phone?<a className="underline font-bold" href={'https://wa.me/'+phone} target="_blank" rel="noopener noreferrer">Conversar no WhatsApp</a>:'O contato de atendimento ainda não foi configurado.'}</p>;}
