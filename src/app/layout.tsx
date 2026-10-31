import {headers} from 'next/headers';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  robots: {index:false,follow:false},
  title: 'Vila Matuta | Marmitas Artesanais & Gestão',
  description:
    'Plataforma de marmitas artesanais personalizadas, agendamento flexível, pacotes de créditos e gestão de produção.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce=(await headers()).get('x-nonce')||'';
  return (
    <html lang="pt-BR"><head><meta name="csp-nonce" content={nonce}/></head>
      <body className="flex flex-col min-h-screen bg-[#FDFBF7] text-[#27170E] antialiased">
        <AuthProvider>
          <CartProvider>
            <a href="#conteudo" className="skip-link">Pular para o conteúdo</a><Navbar />
            <main id="conteudo" tabIndex={-1} className="flex-1 min-w-0">{children}</main>
            <Footer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
