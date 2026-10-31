# Revisão de segurança — 08/10/2026

## Estado vigente
Esta revisão não equivale a pentest externo nem garantia de segurança absoluta. Código local preparado; nenhuma configuração externa aplicada. Guia: docs/DEPLOYMENT_SECURITY.md.

- APIs privadas verificam JWT e propriedade; admin conferido no banco. Clientes não escolhem user_id, role, status financeiro ou preço. Testes IDOR para checkout, operação admin e recursos de outra conta.
- RLS e grants complementares; tabelas pessoais/operacionais sem acesso direto anon/authenticated; RPCs sensíveis service_role somente. Perfis agora só são alterados via API, impedindo gravação em claro por fora da criptografia.
- Rate limit persistido no PostgreSQL, atômico, por conta e IP; identidades HMAC, expiração, HTTP429/Retry-After e falha fechada. Headers de IP somente do proxy configurado. Não depende da memória de funções serverless.
- Supabase Auth gerencia senhas (bcrypt com salt). Turnstile preparado no login/recuperação; CAPTCHA e rate limits nativos do Supabase ainda precisam ser ativados para proteger também seu endpoint direto.
- AES-256-GCM server-side em campos pessoais operacionais; IV12 bytes aleatório, tag16, AAD com ID do cliente, chave32 bytes versionada em ambiente. Rotação e script de migração sem imprimir dados pessoais. Auth/whitelist mantêm e-mails de autenticação/convites; metadados operacionais consultáveis não são cifrados.
- Inputs tipados/limitados, JSON100KB em streaming, rejeição de mass assignment, validação de origem. React renderiza texto; sem HTML bruto de usuário ou SQL interpolado. Erros inesperados não expõem stack/SQL/segredos.
- CSP nonce+strict-dynamic em produção, bloqueio de iframe, nosniff, referrer/permissions policy, HSTS emHTTPS, respostas no-store. Estilos inline ainda permitidos; eval só no desenvolvimento do Next.
- Checkout com reserva30min, verificação atômica, reivindicação da geração de link e tratamento de resultado desconhecido sem duplicar cobrança. Webhook/retorno consultam gateway; redirect sozinho não marca pago.
- Variáveis públicas e servidor separadas, .env.* ignorado, script security:check-env. Nenhum segredo real criado ou exposto.

## Evidências atuais e limites
37 testes passaram: SQL, RLS/grants, reservas, prazo de endereço, remarcação, criptografia/tampering/rotação, inputs e IDOR. TypeScript/build aprovados. pnpm audit --prod em08/10: nenhuma vulnerabilidade conhecida após corrigir4 alertas (Next15.5.27, source-map-js1.2.2 e sharp0.35.5).
Integrações reais Supabase Auth, SMTP, CAPTCHA, WAF e InfinitePay ainda não homologadas. Criptografia das escritas novas não cifra retroativamente registros/backups antigos: executar privacy:migrate em manutenção. Leitura antiga aceita para transição.
Demo é fictícia e usa localStorage; rascunhos locais podem ser lidos por quem acessa o perfil do navegador. Sessão Supabase client-side não usa cookies HttpOnly. MFA obrigatório no admin do aplicativo, processos de retenção/exclusão/exportação, backups operacionais e paginação em escala continuam pendentes.
WAF é complemento; configurar regras gratuitas e origem no host. Rate limit do site não substitui configuração do Auth ou proteção DDoS antes do app.

---
## Registro histórico — 27/09/2026 (substituído onde divergir)

## Problemas encontrados e tratados
- Login e papel admin eram controlados pelo navegador. Demo agora só em desenvolvimento; produção autentica com Supabase e cada API valida token/proprietário. A área da cozinha tem guarda visual adicional; a proteção de dados está na API.
- Perfil podia atualizar a própria coluna role. Migração revoga UPDATE geral e concede apenas colunas pessoais.
- Clientes podiam inserir pedidos financeiros diretamente com campos controlados por eles. Escritas diretas antigas revogadas; API recalcula preços e valida ingredientes.
- Whitelist possuía função mas não trigger de bloqueio em auth.users. Agora existe BEFORE INSERT.
- Webhook respondia que marcou como pago sem confirmação nem persistência. Agora verifica o pagamento no gateway, total esperado, pedido existente e grava por RPC.
- Pagamento usava endpoint não correspondente ao Checkout e Pix inventado como fallback. Substituído por links oficiais no servidor, sem fallback financeiro.
- Capacidade e saldo sem proteção transacional. Novas RPCs usam lock PostgreSQL, validação de propriedade e idempotência. transaction_id é único.
- Next.js 14 sem suporte; atualizado para 15.5.26. Supabase SSR e PostCSS atualizados; auditoria de produção sem vulnerabilidades conhecidas.
- Remote images aceitavam qualquer host; configuração ampla removida. Acrescentados headers de segurança.
- Docker expunha senha estática e porta em todas as interfaces; agora senha de ambiente e bind loopback.

## Evidências
17 testes automatizados: calendário/fuso, volume, distribuição, mínimo por sabor, saldo, limite global, transações repetidas, valor incorreto, proprietário incorreto, permissões de perfil/financeiro, migrações e whitelist.
Os testes SQL usam PGlite com roles e auth mínimos para simular a infraestrutura Supabase. Não substituem validação no projeto Supabase real nem testes de concorrência de múltiplas conexões.
Build otimizado e TypeScript aprovados. Auditoria pnpm audit --prod não encontrou vulnerabilidades conhecidas na data.
Browser: pedido de 100, saldo de 30 e posterior agendamento; segundo pedido completou 120 no dia e a UI bloqueou a data.

## Limites e trabalho operacional
- Migrações não aplicadas em conta real. Nenhuma cobrança real executada.
- PAYMENTS_ENABLED=false por padrão; demo não envia cobranças.
- Não há autenticação por assinatura de webhook documentada nesta integração; a prova de pagamento é uma consulta servidor-a-servidor ao payment_check.
- Webhooks inválidos não mudam status, mas limites de tráfego/outbound devem ser configurados na hospedagem.
- Confirmar política comercial para pagamento cuja data lotou, cancelamentos e estornos. A aplicação preserva o saldo; não executa estorno automático.
- CSP inicial cobre frame-ancestors, object-src e base-uri; uma política de scripts com nonce e relatórios é melhoria futura.
- Catálogo ainda vem do arquivo canônico; gestão pelo banco precisa de fluxo próprio.
- Dados de endereço e restrições alimentares precisam de política de privacidade, retenção, exclusão e acesso operacional mínimo.
- Supabase Auth precisa de convite, confirmação de email e limites de login configurados.
- Dados de demonstração no localStorage são editáveis e não constituem controle de segurança.

## Atualização 31/10/2026 — demonstração pública
A revisão atual está em [docs/REVIEW_20261031.md](docs/REVIEW_20261031.md). Ela substitui a restrição histórica de demo apenas em desenvolvimento: agora há opt-in explícito, sem credenciais, com APIs/banco/gateway bloqueados, fixtures locais e reset isolado. Next.js atualizado para 15.5.28 após nova auditoria. Não houve deploy ou homologação de integrações reais.
