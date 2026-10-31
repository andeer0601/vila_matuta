# Demonstração pública do Vila Matuta

Esta entrega prepara uma demonstração de interface e regras com dados fictícios. Não é uma loja pronta para vender. Não foi publicado nenhum site nem conectado nenhum serviço real.

## Configuração do host

Use um projeto e hostname HTTPS exclusivos para a demonstração, com suporte a Next.js 15 / Node.js 22. O projeto usa middleware e renderização dinâmica; não publique apenas a pasta `public` nem use exportação estática.

Defina **na compilação e na execução**:

```
NEXT_PUBLIC_DEMO_MODE=true
PAYMENTS_ENABLED=false
```

Deixe vazias as variáveis de Supabase, InfinitePay, CAPTCHA, criptografia e rate limit. Não copie configurações de um ambiente real. Rode:

```
corepack pnpm install --frozen-lockfile
corepack pnpm security:check-env
corepack pnpm test
corepack pnpm build
corepack pnpm start
```

O arquivo `.env.example` documenta ambos os modos; não envie arquivos `.env` com dados reais. A compilação recusa combinações de demo com credenciais de serviços ou pagamentos ativos. `security:check-env` diferencia demonstração de operação real. Alterar a flag exige uma nova compilação; não reutilize build de modo diferente.

## Acessos e dados

Em `/entrar`, escolha Mariana, Lucas ou Anderson (Administrador), sem senha. Os perfis são públicos e não constituem autenticação ou autorização segura. O painel de administração é intencionalmente acessível para teste.

Pedidos, endereços, preferências e carrinhos ficam no navegador. Os três perfis compartilham essa simulação local; outro navegador ou dispositivo terá dados separados. Use apenas dados inventados, inclusive em campos de telefone, endereço e restrições alimentares. Não há envio de pedido à equipe, cobrança ou entrega real.

O botão **Recomeçar demonstração** pede confirmação e apaga apenas as chaves `vm_public_demo_v1_...`. Rascunhos antigos da aplicação não são importados nem apagados. Sair encerra o perfil selecionado, mas preserva o teste para retomada. O host ainda pode registrar IP e metadados de acesso: configure sua retenção de logs.

## Isolamento de serviços

- Middleware devolve 403 para todas as APIs no modo demo, inclusive login, checkout, reconciliação e webhook.
- Funções de banco, cliente Supabase e requisições InfinitePay recusam execução em demo como segunda camada de proteção.
- A busca de CEP usa uma fixture local; atendimento não abre WhatsApp na demo.
- Não existe formulário de cartão, chave Pix, QR de pagamento ou senha nos acessos fictícios.
- Conteúdo mantém CSP com nonce, proteção contra framing, no-store, nosniff e noindex. Esses controles não substituem HTTPS e limites de uso no host.

## Roteiro de aceite no host

1. Abra `/entrar` numa janela privada; verifique os avisos e entre como Mariana.
2. Monte uma combinação com no mínimo duas unidades; edite, remova e recarregue para conferir o rascunho.
3. Teste uma entrega e entregas programadas, saldo por sabor, preferência de período, capacidade de 120 e mínimo de duas unidades.
4. Crie um pedido, reserve por 30 minutos e clique em **Simular pagamento recebido**. Nenhum gateway deve abrir.
5. Confira saldo, agendamento e endereço específico em Pedidos e entregas.
6. Troque para Lucas: pedidos pessoais de Mariana não devem aparecer na lista de Lucas.
7. Entre como Anderson: avance preparo, pronto, a caminho e entregue; teste remarcação, lista de ingredientes, bloqueio/reabertura de datas e recusa de bloqueio com reservas.
8. Teste sair, acesso não autenticado, senha indisponível na demo, página inexistente e recomeçar/cancelar reset.
9. Repita em celular e desktop, teclado e zoom. Confira ausência de rolagem horizontal e campos com rótulos.
10. Confirme que `/api/availability`, `/api/orders`, `/api/auth/login` e `/api/webhooks/infinitepay` devolvem 403, inclusive chamadas diretas, e que os headers de segurança permanecem no host.

## Antes de operar com dados ou pagamentos reais

A demonstração não homologa Supabase, SMTP, CAPTCHA, gateway ou infraestrutura. Para operar de verdade, use outro ambiente, `NEXT_PUBLIC_DEMO_MODE=false`, todas as migrações e o checklist em `DEPLOYMENT_SECURITY.md`. Ainda faltam homologaçao de pagamento/retorno/webhook/repetições, política de privacidade e retenção/exclusão, MFA administrativo, fluxo de cancelamento/reembolso, definição de frete/área atendida e decisões comerciais já registradas no contexto. Os preços e regras existentes foram preservados.

## Verificação HTTP reproduzível

Depois do build, inicie a demo em loopback com corepack pnpm start --hostname 127.0.0.1 --port 3100 e, em outro terminal, execute corepack pnpm test:demo-http. O script consulta somente 127.0.0.1:3100, testa 51 combinações de método/caminho, incluindo APIs com sufixos de imagem, e exige headers completos, CSP sem destinos externos e imagem pública legítima funcionando. A mesma validação de ambiente é compartilhada pelo build/start e pelo check-env.
