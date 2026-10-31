# Publicação e segurança — 08/10/2026

O projeto está implementado e testado localmente. Nenhuma conta externa foi configurada neste trabalho. Este guia distingue código entregue de configuração ainda necessária.

## Infraestrutura inicial

Candidata: Netlify Free + Supabase Free. Netlify permite projetos comerciais, mas o plano gratuito tem créditos finitos e pode pausar o site ao esgotá-los. Não há promessa de operação gratuita ilimitada. Usar Cloudflare Free com domínio próprio para DNS/WAF e Turnstile para CAPTCHA. O domínio normalmente tem custo separado.
Vercel Hobby é restrito a uso pessoal não comercial, portanto não é indicado para vender marmitas. Se preferir Vercel, avaliar plano comercial.

Fontes oficiais consultadas:
- [Netlify Free e uso comercial](https://www.netlify.com/blog/introducing-netlify-free-plan/)
- [Créditos Netlify](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Cloudflare WAF](https://developers.cloudflare.com/waf/)

## Ordem de implantação

1. Criar ambientes separados de teste e produção; não compartilhar banco, service key ou chave de criptografia. Configurar HTTPS.
2. Aplicar todas as migrações de supabase/migrations em ordem de nome. A quarta revoga gravações diretas em profiles para impedir contornar a criptografia. Não aplicar parcialmente e manter frontend antigo.
3. Cadastrar o email admin em allowed_emails antes do convite Supabase Auth. Clientes são convidados; cadastro público permanece fechado.
4. Definir variáveis abaixo no gerenciador do host; nunca no repositório nem no chat. Rodar `pnpm security:check-env` no ambiente de implantação.
5. Configurar SMTP e URLs de retorno no Supabase: domínio exato e `/redefinir-senha`. Para convites, o template pode apontar para `{{ .SiteURL }}/redefinir-senha?token_hash={{ .TokenHash }}&type=invite`; recuperação também aceita token_hash/type=recovery ou o fluxo PKCE iniciado no mesmo navegador. A página verifica o token pelo Supabase e limpa a URL. Validar convite, login, recuperação e expiração de links. Não usar wildcard amplo em produção.
6. Ativar CAPTCHA Turnstile no próprio Supabase Auth e configurar rate limits em Authentication > Rate Limits. O endpoint Auth público também existe fora do site: o limitador da aplicação não o substitui.
7. Havendo dados reais antigos, pausar escritas, obter backup protegido e testar restauração. Executar `pnpm privacy:migrate` (simulação), conferir e só então `pnpm privacy:migrate --apply`. Não executar enquanto o site grava pedidos. Backups antigos continuam contendo o estado anterior.
8. Implantar, testar com duas contas distintas (IDOR), conferir headers, cookies, logs sem dados pessoais e host/proxy configurado. Confirmar uso dos limites esperados.
9. Configurar InfinitePay, URL do webhook e retorno. Manter PAYMENTS_ENABLED=false até homologar. Fazer cobrança real apenas com autorização do responsável e verificar replay, atraso, valor, reserva e saldo.
10. Ativar WAF e alertas de quota/erros. Simular restauração periodicamente e manter contato operacional para pagamentos pendentes.

## Variáveis

| Variável | Visibilidade e função |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Pública, URL do projeto |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Pública, chave anon/publishable; segurança depende de RLS e grants |
| NEXT_PUBLIC_DEMO_MODE | false no host; demo nunca ativa em build de produção |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Pública; secret correspondente cadastrado no Supabase Auth |
| SUPABASE_SERVICE_ROLE_KEY | Somente servidor; nunca usar como chave pública |
| APP_URL | Origem HTTPS canônica |
| DATA_ENCRYPTION_KEYS | Somente servidor; JSON de IDs de chave para chaves base64 de32 bytes |
| DATA_ENCRYPTION_ACTIVE_KEY | ID da chave ativa, inicialmente v1 |
| RATE_LIMIT_SECRET | Somente servidor; segredo aleatório independente de pelo menos32 caracteres |
| TRUSTED_PROXY | netlify ou vercel somente quando implantado nessa plataforma; none local |
| INFINITEPAY_HANDLE | InfiniteTag do vendedor |
| PAYMENTS_ENABLED | false até homologação |

Gerar segredos com gerador criptográfico confiável (por exemplo Node crypto.randomBytes), diretamente no ambiente local seguro. Não reaproveitar senha, anon key, service key ou chave de criptografia como RATE_LIMIT_SECRET. Não registrar chaves reais em documentos, logs ou screenshots.

## Criptografia e senhas

Senhas são responsabilidade do Supabase Auth: bcrypt com salt, sem possibilidade de recuperar a senha original. A aplicação não grava senhas. Configurar comprimento mínimo e reautenticação no provedor. [Documentação oficial](https://supabase.com/docs/guides/auth/password-security).

Dados pessoais operacionais usam AES-256-GCM no servidor, IV aleatório por valor, tag de autenticação e vínculo ao ID do cliente. Nomes, telefone, endereço, restrições alimentares, observações e emails em snapshots ficam cifrados; quantidades, datas, IDs, valores e estados precisam continuar consultáveis. Auth e whitelist mantêm e-mail para autenticação/convites. TLS e criptografia de disco do provedor complementam esta proteção.

Chaves ficam fora do banco. Perder as chaves significa perder acesso aos dados cifrados. Guardar cópia protegida separada do backup do banco. Um invasor com servidor e chaves comprometidos ainda pode ler dados; esta camada não protege contra todo cenário.

Para rotação: adicionar chave v2 mantendo v1 no JSON, tornar v2 ativa, executar migração `--apply --rotate` em manutenção e validar leitura. Preservar v1 enquanto houver backups que dependam dela. Não remover chaves antigas precipitadamente.

O modo demo armazena dados fictícios no navegador. Rascunhos também são guardados no perfil do navegador por conta; quem acessa esse perfil local pode lê-los. Não usar informações pessoais reais na demonstração.

## Rate limit e autenticação

Login do aplicativo:10 tentativas por conta e30 porIP a cada15min. APIs privadas:120 leituras/40 escritas porconta/min e240 porIP/min. Capacidade/configuração pública120/IP/min; webhook300/IP/min. Contadores atômicos no Postgres, identidades HMAC, HTTP429 com Retry-After. Expirados têm limpeza limitada automática. Falha de consulta bloqueia a operação.

Só são aceitos headers de IP sobrescritos pela plataforma selecionada e com indicador de ambiente correspondente. Não confiar em X-Forwarded-For arbitrário. Sem proxy válido, todos compartilham um bucket conservador; configurar antes de lançar e verificar no host.

Ativar limites e CAPTCHA nativos do Supabase; recuperação de senha usa diretamente o SDK e a proteção nativa. Sem essa configuração, não afirmar que o Auth inteiro está protegido pelo limitador do site. [Rate limits](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).

Ativar MFA nas contas administrativas dos provedores. MFA obrigatório no admin do próprio aplicativo ainda não foi implementado. Não confundir essas duas camadas.

## WAF

Vale utilizar o conjunto gratuito de regras da Cloudflare e proteção DDoS antes de pagar por solução dedicada. Ele filtra ataques antes de consumirem servidor/banco, mas não corrige falhas de autorização ou IDOR.

Ativar regras gerenciadas gratuitas, revisar eventos e aplicar limite/challenge ao login conforme os recursos do plano. Não colocar challenge interativo no webhook InfinitePay: ele não é navegador. Não liberar todas as APIs de todas as verificações para contornar um falso positivo.

Verificar se o domínio original do host permite contornar a Cloudflare. Quando possível, restringir a origem usando recursos do host; só configurar DNS não prova que todo tráfego passa pelo WAF. Reavaliar recursos/quotas atuais ao publicar.

## Headers, sessões e privacidade

CSP por nonce + strict-dynamic, bloqueio de iframes, nosniff, referrer/permissions policy, no-store e HSTS emHTTPS. CSP exige páginas dinâmicas neste projeto, aumentando consumo de funções: acompanhar créditos. Scripts eval só no desenvolvimento; estilos inline ainda permitidos.
SDK Supabase do navegador precisa ler a sessão; os cookies não são HttpOnly. CSP e validação reduzem risco de XSS, mas não eliminam a necessidade de revisão. Não logar tokens, senha, corpo de login, endereços ou restrições alimentares.

Antes de operação real: definir aviso de privacidade, retenção, solicitação de exclusão/exportação e acesso restrito de funcionários. Esses processos não foram inventados automaticamente. Definir também atendimento e reembolso de pagamentos que não consigam ser reagendados.

## Checklist de evidência

`pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm security:audit` e `pnpm security:check-env` (com ambiente configurado). Testes locais não substituem homologação Supabase/SMTP/Turnstile/InfinitePay/WAF reais. Sem conta conectada, não afirmar ativação em produção.

## Ambiente público de demonstração (31/10/2026)
Para demonstrar sem serviços reais, use o fluxo separado em [PUBLIC_DEMO.md](PUBLIC_DEMO.md): NEXT_PUBLIC_DEMO_MODE=true no build e runtime, PAYMENTS_ENABLED=false, nenhuma credencial real. As exigências de produção real acima continuam válidas para uma loja autenticada. O teste público não homologa pagamentos ou banco.
