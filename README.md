# Vila Matuta

## Teste público com dados fictícios

Veja [docs/PUBLIC_DEMO.md](docs/PUBLIC_DEMO.md) para configurar o host isolado, acessos de Mariana/Lucas/Anderson e roteiro de aceite. Use `NEXT_PUBLIC_DEMO_MODE=true` no build e na execução, `PAYMENTS_ENABLED=false` e nenhuma credencial real. A demo não autentica pessoas e não processa pagamentos.

## Rodar localmente
Requer Node.js 20.9+ e pnpm 11.19.0.

    pnpm install --frozen-lockfile
    pnpm dev

Abra http://localhost:3000. O modo de desenvolvimento apresenta perfis e pagamentos fictícios, sem conexão externa.

    pnpm test
    pnpm typecheck
    pnpm build

## Conectar Supabase e InfinitePay
1. Copie .env.example para .env.local. Nunca publique esse arquivo.
2. No Supabase, aplique todas as quatro migrações em ordem cronológica. As últimas acrescentam reservas, endereços, calendário e proteção das tabelas pessoais.
3. Adicione o email do administrador com role admin em allowed_emails antes de criar o usuário pelo Supabase Auth. Convide os clientes de teste da mesma forma. Não há cadastro público.
4. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. A SUPABASE_SERVICE_ROLE_KEY fica exclusivamente no servidor.
5. Configure as chaves de criptografia, segredo de rate limit, proxy e CAPTCHA conforme docs/DEPLOYMENT_SECURITY.md. Rode `pnpm security:check-env`. Use NEXT_PUBLIC_DEMO_MODE=false e reinicie. Entre em /entrar e complete /onboarding.
6. Preencha INFINITEPAY_HANDLE com a InfiniteTag do vendedor, sem o símbolo inicial, e APP_URL com o domínio HTTPS público.
7. Homologue as regras comerciais e o pagamento antes de ativar PAYMENTS_ENABLED=true. Esta entrega não altera frete.
8. Faça uma compra real autorizada de homologação e confira link, callback, webhook, valor, capacidade e saldo.

A API do Checkout documentada utiliza a InfiniteTag, sem a antiga INFINITEPAY_API_KEY. O servidor envia preços em centavos para /links e confirma cada notificação por /payment_check. O link persiste no pedido e pode ser retomado.

Ao seguir para o pagamento, a capacidade fica reservada por 30 minutos. Após expirar, pagamentos tardios revalidam as datas; se lotadas, o valor é registrado e as marmitas ficam no saldo, sem exceder a cozinha. Definir atendimento/reembolso para quem não puder aceitar outra data.

Não foi feita cobrança real nesta implementação. A configuração do banco e a homologação ainda são necessárias.

## Documentos
- PROJECT_CONTEXT.md: regras atuais e decisões.
- SECURITY_REVIEW.md: correções, evidências e limites.
- docs/DEPLOYMENT_SECURITY.md: hospedagem, ambientes, CAPTCHA/WAF, migração de criptografia e homologação.
- https://www.infinitepay.io/checkout-documentacao: contrato oficial consultado.
- https://nextjs.org/support-policy: suporte de versões.

O PostgreSQL do docker-compose.yml é opcional para experimentos e não substitui o Supabase. Defina POSTGRES_PASSWORD no ambiente antes de iniciar; o banco escuta apenas no loopback.
