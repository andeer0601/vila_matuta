 'use client';
import {useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useCart} from '@/context/CartContext';
import {operate} from '@/lib/operations';
export function MoveProduction({orderId,planId}:{orderId:string;planId:string}){const {user}=useAuth();const {refresh}=useCart();const [date,setDate]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);return <div className="border-t mt-4 pt-4 space-y-3"><label className="block text-sm">Remarcar produção por imprevisto<input type="date" className="field mt-1" value={date} onChange={e=>setDate(e.target.value)}/></label><p className="text-xs text-stone-500">Combine a mudança com o cliente antes de salvar. Não há envio automático de mensagens.</p><button className="button-secondary" disabled={!date||busy} onClick={async()=>{if(!user)return;setBusy(true);try{await operate(user,{action:'move',orderId,planId,date});await refresh();setMessage('Produção remarcada.');}catch(e){setMessage(e instanceof Error?e.message:'Falha ao remarcar.');}finally{setBusy(false);}}}>Salvar nova produção</button>{message&&<p role="status" className="notice">{message}</p>}</div>;}
