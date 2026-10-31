'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}) {
 return <section className="max-w-xl mx-auto px-5 py-12 space-y-5"><h1 className="text-3xl font-bold">Não foi possível abrir esta tela</h1><p>Tente novamente. Se o problema continuar na demonstração, volte à entrada para recomeçar os dados de teste.</p><div className="flex flex-wrap gap-3"><button className="button-primary" onClick={reset}>Tentar novamente</button><Link className="button-secondary" href="/entrar">Voltar para entrada</Link></div></section>;
}
