## Atualização 31/10/2026 — capacidade por data (implementada; sem publicação)

- 120 unidades é o padrão. O Administrador pode ajustar uma produção futura específica entre 2 e 10.000, sem mudar outros dias; bloqueio total continua em “Marcar sem produção”.
- Nunca reduzir abaixo de pedidos pagos e reservas de pagamento ainda válidas. Restaurar 120 também respeita esse mínimo. Reservas expiradas e pedidos cancelados não comprometem capacidade.
- Demo: configurações em localStorage, com o mesmo Web Lock dos pagamentos. Banco: nova migração 20261031_daily_capacity.sql, RPC apenas service_role, verificação de administrador e o mesmo advisory lock 72841921 de reservas/pagamentos.
- A migração deve ser aplicada antes desta versão em ambiente real. Não foi aplicada a serviço externo. O demo não depende de banco.
- Montagem, sugestões, agendamento de saldo, remarcação e checkout consultam o limite por data; produção fechada tem disponibilidade zero.
- A suite usa PGlite: executa SQL e operações enfileiradas, mas não substitui ensaio com múltiplas conexões concorrentes em Postgres real.

# Atualização vigente — demonstração pública (31/10/2026)

Este bloco substitui as afirmações históricas abaixo sobre demo somente em desenvolvimento. Foi solicitada revisão completa de UI/UX, acessibilidade, textos e segurança antes de um teste público; nenhum deploy, conta externa ou pagamento real foi autorizado nesta etapa.

- Next.js atualizado para 15.5.28 após consulta atual ao npm apontar dois avisos na versão 15.5.27; nova auditoria de produção sem vulnerabilidades conhecidas.
- Demo em produção exige NEXT_PUBLIC_DEMO_MODE=true explicitamente no build e runtime; sem flag, produção continua no modo real. PAYMENTS_ENABLED=false e credenciais vazias. Build e check-env recusam mistura com serviços reais.
- APIs bloqueadas em demo no middleware; banco e gateway também recusam chamadas diretas. ViaCEP usa fixture e suporte não abre WhatsApp. Webhook real preserva 429/Retry-After e falhas transitórias 5xx.
- /entrar oferece Mariana, Lucas e Anderson (Administrador), sem senha e com aviso explícito de acesso público, armazenamento local e dados fictícios. Escolha de perfil saiu do menu do cabeçalho. Primeira visita começa sem usuário.
- Dados isolados no prefixo vm_public_demo_v1_; não importa rascunhos antigos. Reset confirmado remove só esse prefixo; sair preserva a simulação.
- UI: laranja com contraste melhor, navegação responsiva e nomes acessíveis, skip-link, inputs móveis de 16px, redução de movimento, labels/seleções, cidade/UF editáveis, correção de requisição de CEP concorrente, id duplicado removido, estados de erro/404 e orientação sobre integrações simuladas. Preços, frete e regras comerciais preservados.
- Persistências concorrentes de criação e agendamento demo usam Web Locks, como reservas/pagamentos já faziam. HTTPS exigido no host.
- Documentação operacional e roteiro: docs/PUBLIC_DEMO.md. Validações finais e limites: docs/REVIEW_20261031.md.
- Esta pasta não possui .git: não foi possível obter diff/status ou criar commit; arquivos existentes foram editados in-place sem apagar o projeto.

---

# Vila Matuta — contexto atual (08/10/2026)

## Estado vigente — substitui os registros históricos abaixo
Implementação local e APIs preparadas. Nenhuma conta Supabase/InfinitePay conectada, nenhum pagamento real nem migração externa. Demo só em desenvolvimento. Documentação de implantação e segurança: docs/DEPLOYMENT_SECURITY.md e SECURITY_REVIEW.md.

### Decisões confirmadas pelo usuário
- Não alterar frete, área atendida, horários ou preços (inclusive 30=R$450 / 31=R$434).
- Produção segunda, quarta e sexta, até120 unidades/dia, nunca hoje/passado, fuso São Paulo.
- Data selecionada é PRODUÇÃO; entrega pode ocorrer nesse dia ou no seguinte.
- Preferência Manhã/Tarde/Noite no cadastro, com escolha por entrega.
- Reserva ao seguir para pagamento por **30 minutos**, ocupando capacidade antes da confirmação. Pagamento tardio tenta novamente; se lotado, conserva saldo pago para reagendamento/atendimento.
- Endereço principal atualiza produções futuras dentro do prazo, preservando escolhas específicas. Alterações até23h59 da véspera; depois WhatsApp.
- Todos os endereços usados ficam salvos; escolha específica pergunta se também deve virar principal.
- WhatsApp configurável no admin; nenhum número fictício. Sabor comprado continua garantido após sair do catálogo de novas vendas.
- Segurança solicitada: auth, IDOR, RLS, rate limit, criptografia, ambiente e inputs; infraestrutura gratuita quando viável.

### Implementado nesta continuação
Carrinho/planejamento persistidos por conta e adoção do rascunho visitante; edição de combinação; resumo móvel; carregamento/erros/retry. Endereços em /enderecos e por entrega em /meus-pedidos. Período também em /onboarding. Recuperação/definição de senha, logout e retorno ao montador após login.
/admin/slots configura WhatsApp e bloqueia/reabre produção. Recusa bloquear dia com reservas/pedidos: combinar e remarcar primeiro. /admin acompanha cada entrega scheduled→preparing→ready→in_delivery→delivered e permite remarcar antes do preparo com capacidade atômica. Histórico delivery_events no banco. Sem mensagens WhatsApp ou reembolso/cancelamento automático.

### Banco e pagamentos
Aplicar quatro migrações em ordem: 20260826_init.sql, 20260927_production_and_security.sql, 20261008_operations.sql, 20261009_security.sql (última criada em08/10, nome ordenado).
Novas tabelas saved_addresses, production_closures, shop_settings, delivery_events, api_rate_limits. production_reservations.expires_at nulo=pago; futuro=reserva temporária. View conta apenas reservas ativas, sem cron obrigatório. Bloqueios agregados como indisponibilidade.
Lock transacional72841921 serializa reservas, pagamentos, agenda, endereço, bloqueios e remarcações. prepare_plans gera IDs/snapshots server-side. Cliente não define preço, role, propriedade ou status.
Criação usa requestId para retry idempotente. Checkout_claimed_at gravado antes da chamada externa impede geração paralela de links. Link existente reutilizado. Resultado externo desconhecido exige conferência manual; não criar outra cobrança às cegas. Admin mostra pendência.
PAYMENTS_ENABLED só bloqueia novas cobranças; verificação de anteriores continua. Webhook e retorno com transaction_nsu/slug usam payment_check antes de confirmar. Sem essas referências, não há reconciliação automática cega por número do pedido.
Pedido pendente com checkout iniciado não permite trocar datas, pois link antigo ainda pode ser pago. Atendimento necessário; admin remarca pedidos pagos antes do preparo.

### Segurança e ambiente
Next15.5.27; overrides PostCSS8.5.28, source-map-js1.2.2, sharp0.35.5. Senhas geridas pelo Supabase Auth (bcrypt), sem login/tabela de senhas próprios.
JWT verificado por getUser, propriedade extraída da sessão, role admin conferido no banco. RLS/grants restringem perfis e tabelas operacionais ao servidor; RPCs sensíveis service_role somente.
Login10/conta e30/IP por15min; APIs leitura120/escrita40 porconta/min e240/IP/min; públicos/webhook com limites próprios. Contadores Postgres atômicos, identidades HMAC e429/Retry-After. Só confiar no proxy configurado; sem proxy, bucket global conservador.
Turnstile preparado por NEXT_PUBLIC_TURNSTILE_SITE_KEY. Secret e CAPTCHA nativo devem ser ativados no Supabase, junto dos limites do próprio Auth (endpoint público independente do app).
AES-256-GCM server-side em dados pessoais operacionais: nome, telefone, endereços, restrições/observações e e-mails nos snapshots. IV aleatório, AAD ligada ao cliente, chaveiro versionado separado do banco. IDs/datas/valores/status continuam consultáveis. Auth/whitelist ainda guardam e-mails de login/convite; profiles novos usam pseudônimo @auth.invalid.
Histórico em claro exige privacy:migrate com manutenção, backup e chaves antigas preservadas. Leitura antiga existe para transição. Não declarar histórico criptografado sem executar migração. Demo fictícia usa localStorage sem criptografia de banco.
Inputs tipados/limitados, JSON100KB em streaming, origem de mutations verificada, sem HTML bruto; erros inesperados não expõem SQL/stack. CSP nonce+strict-dynamic, DENY, nosniff, HSTS emHTTPS e no-store. Páginas dinâmicas por nonce: monitorar consumo do host.
Segredos só no servidor; .env.* ignorado e exemplo sem valores reais. Scripts security:check-env, security:audit e privacy:migrate (simulação; --apply e --rotate para manutenção). Nenhuma chave real gerada neste trabalho.

### Validação e pendências reais
37 testes aprovados (regras, SQL, grants/RLS, reservas, remarcação, endereço/prazo, criptografia/tampering/rotação, inputs e IDOR). Typecheck e build aprovados. pnpm audit --prod sem vulnerabilidades conhecidas após corrigir4 alertas.
Browser: montagem/reload, reserva30min, pagamento fake, endereço específico/período, principal preservado, endereço adicional, bloqueio/reabertura e preparo. Build de produção testado: login interativo sob CSP, APIs privadas401 sem sessão, no-store e scripts sem unsafe-inline. Supabase/SMTP/CAPTCHA/WAF/gateway reais continuam sem homologação.
Ainda configurar contas, migrations, env, SMTP, CAPTCHA, rate limits Supabase, HTTPS/WAF e homologar InfinitePay. Não houve deploy. Não executar dev/build simultaneamente (mesmo .next).
Faltam processo de cancelamento/reembolso, privacidade/retenção/exclusão/exportação, MFA obrigatório no admin do app e paginação do histórico. Catálogo gerenciável, fotos, notificações, etiquetas e favoritos continuam futuros.
Hospedagem candidata: Netlify Free (comercial, créditos finitos)+Supabase Free+Cloudflare Free/Turnstile. Vercel Hobby não permite uso comercial.

---
## Registro histórico de 27/09 e revisão anterior (não é o estado vigente)
Atualizado em 27/09/2026. Este documento substitui as regras de 26/08/2026 onde houver divergência.

## Objetivo e estado
Automatizar a compra de marmitas artesanais, montagem de sabores, distribuição de entregas e produção da cozinha.
A aplicação pode ser explorada sem credenciais em **demonstração local**. Existe implementação de API e migrações para Supabase/InfinitePay, mas nenhuma conta real foi conectada nem pagamento real testado.

## Stack
- Next.js 15.5.26 App Router, React 19.2.4, TypeScript, Tailwind 3.
- Supabase Auth/PostgreSQL; cliente autentica com sessão Supabase. Servidor verifica JWT via getUser.
- InfinitePay Checkout: links e payment_check, somente no servidor.
- pnpm 11.19.0; pnpm-lock.yaml é o lockfile oficial. PostCSS 8.5.28 fixado em pnpm-workspace.yaml para correções transitivas.
- Testes de regras com node:test; migrações e permissões executadas em PostgreSQL via PGlite.

## Identidade e catálogo
PDF na raiz usado como referência de mel/laranja, madeira e chapéu. A marca foi recortada em public/vila-matuta-marca.webp.
A proposta apresenta comida brasileira artesanal, congelada e pronta para aquecer.
Mantidas as combinações do projeto: 1 base + 1 proteína + 2 acompanhamentos distintos ou prato completo.
O catálogo canônico desta versão é src/lib/supabase/mock-data.ts, compartilhado com a validação do servidor. Alterações em ingredients no banco ainda NÃO alteram esse catálogo.
O PDF tem preços diferentes e uma seleção menor. Não substituímos catálogo nem preços automaticamente, conforme pedido do usuário.

## Preços atuais (preservados)
- Até 10: R$18/un.
- 11–20: R$180 + R$14 por unidade acima de 10.
- 21–30: R$320 + R$13 por unidade acima de 20.
- Acima de 30: R$14 por unidade para todo o pedido.
- 100 marmitas = R$1.400, independentemente do número de entregas.
- Atenção comercial: a tabela original tem uma queda de R$450 (30) para R$434 (31). Foi preservada; decidir com o dono se deve mudar.
- Frete e área atendida ainda indefinidos. Pagamentos ficam desativados por padrão.

## Regras ativas de produção e saldo
- Produção somente segunda, quarta e sexta.
- Máximo **120 unidades por dia**, somando todos os pedidos/clientes; substitui limite por turno.
- Nunca aceitar hoje ou passado; calendário usa America/Sao_Paulo. Regra antiga de quatro dias e override de capacidade foram removidos.
- Datas sem capacidade suficiente são desabilitadas; sugerir próxima produção disponível.
- Pedido pendente não reserva vagas. Pagamento verificado reserva todas as entregas numa transação.
- Um lock transacional PostgreSQL serializa verificação/reserva entre clientes; não depende do navegador.
- Se uma data lotar ou vencer durante o pagamento, confirmar o recebimento, não reservar nenhuma das datas, manter todas as unidades como saldo por sabor e marcar needs_rescheduling.
- “Tudo em uma entrega”: distribuir todo o pedido numa única data; mais de 120 exige entregas programadas.
- “Entregas programadas”: duas linhas inicialmente sem quantidades; semanal (+7) ou quinzenal (+14); linhas adicionais e datas editáveis.
- Quantidade por combinação: inteiro >=2. Por entrega: 0 ou >=2. Nunca deixar saldo de exatamente 1 por sabor; números ímpares >=3 são válidos.
- Saldo é específico do sabor comprado: compradas menos alocadas. Não existe mais crédito fictício nem compra duplicada usando saldo genérico.
- Pedidos pagos podem agendar saldo na tela Pedidos e entregas. Uma data já agendada no mesmo pedido não aceita outra linha; escolher uma nova produção.
- Limites de entrada: 10.000 marmitas/pedido, 100 combinações e 200 linhas na API. Datas do seletor mostram aproximadamente um ano.
- Cancelamento, reembolso, remarcação de entrega já reservada e status individual de despacho ainda precisam de fluxo operacional próprio; não há override inseguro.

## Modos e persistência
- DEMO_MODE exige NODE_ENV=development e NEXT_PUBLIC_DEMO_MODE diferente de false.
- Demo: perfis fictícios selecionáveis, pedidos em vm_demo_orders_v2 no localStorage, pagamento de teste explícito, nenhum Pix falso, nenhuma requisição real ao gateway.
- Produção: demonstração desativada independentemente da flag pública; login em /entrar, perfil em /onboarding, APIs com Bearer JWT validado.
- Pedidos de demo antigos continuam preservados nas chaves anteriores, mas não são migrados para o novo modelo.
- Preview atual tem pedidos de teste feitos para validar 100 unidades e lotação; são locais e não representam vendas.

## Banco
Aplicar em ordem as migrações 20260826_init.sql e 20260927_production_and_security.sql.
Tabelas anteriores permanecem para histórico (orders/order_items/customer_credits/shift_configs etc.), mas não recebem as novas compras.
Novo modelo:
- meal_purchases: id, user_id, total_cents, status, payload JSONB com snapshot de sabores/endereço/perfil/entregas, checkout_url, transaction_id UNIQUE, needs_rescheduling, created_at, paid_at.
- production_reservations: purchase_id + delivery_date (PK), quantity. Unidades confirmadas no dia.
- production_capacity: view agregada de unidades por data, acessível somente ao service_role.
- validate_purchase_plans: valida calendário, quantidades, sabor, saldo, datas únicas e capacidade.
- confirm_purchase_payment: idempotente por transação, valida total, reserva ou libera todo o saldo para novas datas.
- schedule_purchase: valida proprietário e saldo; reserva atomicamente se pago; substitui planejamento sem reservar se pendente.
- RPCs e tabelas financeiras novas são acessíveis somente ao serviço. Nenhuma chave privilegiada vai ao cliente.

## API
- GET /api/availability: somente contagem agregada por data, sem dados pessoais.
- GET /api/orders: pedidos do usuário autenticado; admin recebe visão operacional.
- POST /api/orders: valida catálogo, recalcula preço, salva pendente. Nunca aceita preço ou status do cliente.
- POST /api/orders/[id]/checkout: valida proprietário, reutiliza link persistido ou cria link oficial.
- POST /api/orders/[id]/schedule: grava planejamento/saldo pela RPC.
- POST /api/webhooks/infinitepay: valida evento e pedido, consulta payment_check, confere valor, confirma pela RPC; não confia no JSON recebido como prova.
- /api/auth/check-whitelist: deixa de enumerar emails/papéis; bloqueio real é trigger BEFORE INSERT em auth.users.
- Checkout consulta periodicamente os pedidos; não há alegação falsa de Realtime implantado.
- Cozinha e lista de compras projetam cada entrega separadamente, apenas para pedidos pagos.

## Segurança
- Removida escrita de role e identidade do perfil por authenticated; só colunas pessoais editáveis.
- Trigger de whitelist que antes estava definido mas não instalado foi conectado.
- Revogada escrita direta nas tabelas financeiras antigas; novos registros só pelo servidor.
- Corrigido search_path nas funções SECURITY DEFINER.
- URLs do gateway são verificadas; configuração e chave service_role restritas ao servidor.
- Headers nosniff, DENY, referrer-policy, permissions-policy e CSP parcial.
- Docker local usa senha via ambiente e porta só em loopback. PostgreSQL simples não emula Supabase Auth.
- pnpm audit --prod em 27/09/2026: nenhuma vulnerabilidade conhecida após atualização.
- Não é uma auditoria externa nem garantia de segurança completa. Ver SECURITY_REVIEW.md.

## Verificação desta entrega
- 17 testes aprovados, incluindo SQL/RLS, idempotência, capacidade, saldo e fuso.
- TypeScript e build Next.js de produção aprovados.
- Browser desktop e 390px: montagem de 100 unidades, duas entregas + saldo, confirmação de teste, agendamento do saldo, capacidade de 120 e próximo dia.
- Banco real e gateway ainda não homologados. Não foram aplicadas migrações em conta externa.

## Pendências antes de vender
- Configurar Supabase, aplicar migrações e cadastrar emails convidados/administrador.
- Confirmar catálogo, preços, frete, área atendida, horários, feriados e validade do saldo.
- Configurar InfiniteTag, URL HTTPS, webhook e variáveis; manter PAYMENTS_ENABLED=false até homologar.
- Testar cobrança real autorizada, retorno, webhook, repetição e atendimento/reembolso quando a data lotar.
- Adicionar política de privacidade, retenção/exclusão e limitação de requisições no provedor.
- Implementar despacho por entrega, cancelamento/reembolso e remarcação segura.
- Paginar histórico (consulta atual do Supabase segue o limite de retorno configurado), permitir gestão real do catálogo e notificações.
- Depois: fotos reais, notificações WhatsApp, integração logística.

## Histórico
- 26/08/2026: estrutura inicial, catálogo, preços, protótipo local e schema.
- 27/09/2026: nova apresentação visual, quantidade inicial, entregas programadas, saldo por sabor, produção 3x/semana com 120/dia, API InfinitePay oficial preparada, hardening de autenticação/SQL, Next atualizado, testes e documentação.

## Revisão de continuidade — 08/10/2026
Revisão estática do código e documentos, solicitada pelo usuário para identificar lacunas e melhorias. Nenhum comportamento da aplicação foi alterado nesta revisão; testes e auditoria de dependências não foram reexecutados.

### Lacunas confirmadas no código
- CartContext guarda o carrinho somente em memória e limpa items quando user.id muda. Login após montar o pedido pode apagar a montagem; refresh perde o rascunho. Datas/quantidade-alvo também ficam em estado local da página.
- refresh não verifica response.ok de /api/availability; ausência de capacity vira {}. Assim, uma falha pode exibir 120 vagas livres, embora o servidor ainda revalide antes de criar o pedido. Erros de carregamento são silenciados em alguns efeitos.
- A tela de revisão de datas de pedido pendente inicia plans=[] em vez de carregar as entregas existentes; refazer a distribuição é necessário.
- O painel da cozinha lista entregas e copia endereço, mas não tem ações de preparo, despacho e conclusão por remessa. Status permanece no nível do pedido inteiro.
- Falta fluxo completo de primeiro acesso por convite, definição/recuperação de senha e botão de sair (logout existe no contexto, sem uso na interface).
- Checkout verifica o banco a cada 8 segundos, mas não possui reconciliação independente com o gateway quando o webhook falha. Duas requisições simultâneas de criação de checkout podem gerar links antes de checkout_url ser persistido.
- PAYMENTS_ENABLED também condiciona a verificação de pagamentos já feitos; desligar novas cobranças não deveria impedir a confirmação das anteriores.
- Catálogo segue estático; sem gestão de indisponibilidade, calendário de exceções/feriados e capacidades específicas por data.
- Produção e entrega usam a mesma data; turno Manhã é gravado fixamente, sem escolha real de janela pelo cliente.
- Saldo futuro mantém sabor e endereço do pedido original. Faltam decisões/fluxos para sabor descontinuado, mudança de endereço, validade, remarcação, cancelamento e reembolso.

### Ordem sugerida (ainda não aprovada para implementação)
1. Preservar rascunho ao autenticar/recarregar; completar acesso e tratamento de carregamento/erro.
2. Fechar operação de cada entrega: status, exceções de calendário, remarcação/cancelamento e histórico.
3. Definir frete por remessa, área atendida, janelas, validade/substituição de saldo e corrigir a descontinuidade de preços.
4. Configurar e homologar Supabase/InfinitePay; acrescentar reconciliação de pagamentos e impedir criação simultânea de links.
5. Melhorar montagem e planejamento: etapas mais curtas, calendário visual, resumo fixo no celular, edição das combinações e distribuição automática opcional respeitando mínimo/saldo.
6. Complementos posteriores: repetir pedido, favoritos, fotos reais, etiquetas por entrega, notificações e gestão do catálogo.

## Complemento vigente — hardening final 31/10/2026
Validadores demo unificados em scripts/demo-environment.cjs e testados invocando next.config/check-env reais. PAYMENTS_ENABLED=false explícito, credenciais e variáveis públicas inesperadas recusadas. CSP demo sem destinos externos; 403 com headers completos. Matcher /api/:path* não exclui sufixos de imagem. Validação final: 45 testes, build/TypeScript e 51 requisições HTTP (GET/POST/HEAD) bloqueadas, imagem legítima servida. Comando reproduzível pnpm test:demo-http contra a prévia local na porta 3100.

## Versionamento local autorizado — 31/10/2026
O usuário autorizou inicializar Git local e registrar o estado revisado. Este registro substitui a ausência de Git descrita acima. Nenhum remoto ou publicação foi configurado. Código, testes, migrações e documentação entram no commit; dependências, build, .env reais, next-env.d.ts, tsbuildinfo, logs, PDF de referência e PNGs históricos ficam ignorados e preservados no disco. E-mails de exemplo do seed usam example.invalid.
