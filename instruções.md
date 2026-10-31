# MISSION BRIEFING: PLATAFORMA DE MARMITAS PERSONALIZADAS & GESTÃO LOGÍSTICA

Atue como um Engenheiro de Software Full-Stack Sênior e Especialista em UX/UI. Sua missão é projetar e implementar uma aplicação web completa para um serviço de marmitas personalizadas, substituindo a operação manual via WhatsApp por um sistema automatizado de montagem, agendamento, controle de produção/compras e pagamentos.

---

## 0. INSTRUÇÃO MANDATÓRIA DE CONTEXTO LOCAL (`PROJECT_CONTEXT.md`)

Antes de iniciar qualquer código ou arquitetura:

1. Crie na raiz do projeto o arquivo `PROJECT_CONTEXT.md`.
2. Este arquivo deve conter:
   - **Visão Geral do Projeto & Propósito**
   - **Stack Tecnológica Completa e Decisões de Arquitetura**
   - **Esquema do Banco de Dados Atualizado (PostgreSQL / Supabase)**
   - **Regras de Negócio e Políticas Ativas (Agendamento, Slots, Whitelist)**
   - **Endpoints, Webhooks e Contratos de API**
   - **Log de Alterações / Changelog de Funcionalidades Implementadas**
   - **Lista de TODOs e Futuras Features**
3. **REGRA PERPÉTUA:** Sempre que você (Agent) realizar qualquer alteração estrutural, adicionar tabelas, refatorar componentes ou atualizar regras de negócio, você **DEVE** atualizar o arquivo `PROJECT_CONTEXT.md` ao final da resposta para garantir que o contexto do projeto nunca se perca entre sessões de desenvolvimento.

---

## 1. STACK TECNOLÓGICA & INFRAESTRUTURA (CUSTO ZERO)

- **Frontend & Backend API:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide React / Shadcn UI.
- **Banco de Dados & Autenticação:** Supabase (PostgreSQL Gerenciado + Supabase Auth + Supabase Realtime).
- **Hospedagem & Deploy:** Vercel (CI/CD contínuo).
- **Ambiente Local:** Suporte a `docker-compose.yml` para desenvolvimento local isolado, mas com arquitetura 100% pronta para deploy serverless (Vercel + Supabase).
- **Gateway de Pagamento:** InfinitePay (API de Checkout Integrado + Webhook com fallback resiliente).

---

## 2. DESIGN SYSTEM & IDENTIDADE VISUAL ("MODERN RUSTIC WESTERN")

- **Tema Principal:** Modern Western / Ranch Kitchen.
- **Paleta de Cores:**
  - Cor Primária: Laranja Acolhedor / Terracota (`#E65100` / `#EA580C`) - Foco em apetite e energia.
  - Secundária / Acentos: Tons de Madeira Nobre (`#5C4033` / `#8B5A2B`), Bege Couro / Areia (`#F5F0EB` / `#EDE0D4`).
  - Backgrounds: Branco quente e cinzas bem claros para leitura, com cards contendo texturas/bordas sutis de madeira/couro.
- **Elementos Visuais:** Ícones no estilo rústico/western (chapéu de cowboy, campo), detalhes sutis de costura/couro nas bordas dos cards, tipografia moderna e limpa com toques rústicos nos títulos.

---

## 3. AUTENTICAÇÃO, CONTROLE DE ACESSO & ONBOARDING

### 3.1. Whitelist de Cadastro (Fase de Testes Fechada)

- O cadastro é restrito a e-mails autorizados.
- Tabela `allowed_emails (id, email, role, created_at)`.
- Trigger / Hook no PostgreSQL / Supabase que impede o `signUp` caso o e-mail não exista previamente na tabela `allowed_emails`. Mensagem de erro amigável ao usuário.

### 3.2. Fluxo de Autenticação

- Login tradicional com **E-mail e Senha** via Supabase Auth.
- Perfis separados por Roles: `customer` e `admin`.

### 3.3. Onboarding no Primeiro Acesso (Mandatório)

Após o primeiro login, o cliente é direcionado para um fluxo de 3 passos simples:

1. **Dados Pessoais:** Nome, Sobrenome, WhatsApp (com máscara brasileira) e Foto de Perfil (upload opcional).
2. **Endereço de Entrega:** CEP (com busca automática via ViaCEP), Rua, Bairro, Número e Complemento.
3. **Restrições Alimentares:** Campo livre e tags para alergias/intolerâncias (ex: "Sem lactose", "Sem glúten", "Sem coentro", "Diabético"). _Essas restrições devem gerar um badge de alerta visual no painel da cozinha._

---

## 4. FLUXO DO CLIENTE (MONTAGEM, PACOTES & AGENDAMENTO)

### 4.1. Construtor de Marmita ("Monte sua Marmita")

- Interface interativa onde o cliente monta marmitas escolhendo:
  - **1 Base** (ex: Arroz Branco, Arroz Integral, Mandioca)
  - **1 Proteína** (ex: Patinho Moído, Peito de Frango Grelhado, Sobrecoxa)
  - **2 Acompanhamentos** (ex: Legumes no Vapor, Purê de Mandioquinha, Brócolis)
- O preço total da marmita é calculado dinamicamente com base nos ingredientes selecionados.

### 4.2. Modalidades de Compra

1. **Entrega Única:** Compra e agenda uma remessa específica.
2. **Pacote de Créditos / Recorrência Flexível:**
   - O cliente compra um pacote (ex: Pacote 14 Marmitas) com desconto.
   - O sistema credita o saldo de marmitas no perfil do usuário (`customer_credits`).
   - O cliente usa os créditos aos poucos, escolhendo quantas marmitas quer receber e em quais datas.

### 4.3. Regra de Ouro de Agendamento (Trava de 4 Dias)

- O agendamento ou remarcação de entrega só é permitido com no mínimo **4 dias de antecedência** (data da entrega >= data_atual + 4 dias).
- Faltando menos de 4 dias, o agendamento no painel do cliente fica bloqueado com o aviso: _"Alterações com menos de 4 dias devem ser solicitadas diretamente ao suporte"_.
- O Admin tem permissão para alterar a qualquer momento pelo painel dele.

---

## 5. PAGAMENTO RESILIENTE (INFINITEPAY + WEBHOOK + REALTIME)

- **Padrão "Criar Primeiro, Pagar Depois":**
  1. Ao clicar em "Finalizar Pedido", o registro é criado no PostgreSQL com status `Pendente`.
  2. A API gera o link/Pix via InfinitePay e salva o link de checkout no banco.
  3. Se a internet do cliente oscilar ou a página for fechada, o pedido persiste no painel "Meus Pedidos" com o botão "Pagar Agora".
  4. O Webhook da InfinitePay recebe o aviso do servidor e atualiza o pedido para `Pago`.
  5. A tela de checkout do cliente escuta a tabela via **Supabase Realtime** e atualiza para "Pagamento Confirmado!" instantaneamente assim que o Pix é pago.

---

## 6. PAINEL ADMINISTRATIVO (DONO DO NEGÓCIO)

### 6.1. Carrossel de Datas (`< 10 [11] 12 >`)

- Barra superior interativa com navegação rápida de dias.
- Ao clicar em uma data, exibe a lista de todas as entregas do dia, divididas por turno/horário e clientes.
- Exibe o botão rápido **"Copiar Endereço"** em cada pedido para agilizar pedidos manuais de Uber/Flash.

### 6.2. Gerador Automático de Lista de Compras (Ficha Técnica)

- Cada ingrediente cadastrado possui uma **gramatura/quantidade padrão por porção** (ex: Patinho = 150g, Arroz = 100g).
- O Admin pode selecionar um dia ou uma semana e o sistema soma todas as marmitas do período e gera o relatório consolidado:
  - _Exemplo: "Para as 50 marmitas de Terça-feira: 7.5 kg de Patinho, 5.0 kg de Arroz Integral, 2.5 kg de Brócolis"_.

### 6.3. Gestão Dinâmica de Slots e Capacidade

- O Admin configura por dia da semana:
  - Quais turnos estão ativos (ex: Manhã, Noite; facilidade para ativar Tarde futuramente).
  - Limite de clientes/pedidos por turno (ex: padrão 3 clientes por turno).

---

## 7. ITENS GUARDADOS NA LISTA DE TODOs (FUTURAS REGRAS)

Documente no `PROJECT_CONTEXT.md` a seção de TODOs:

- [ ] Implementar regra de precificação de frete/taxa de entrega (fixa, raio de distância ou frete grátis por pacote).
- [ ] Definir e aplicar política de validade/expiração para os pacotes de créditos.
- [ ] Avaliar integração direta com Uber Direct API caso o volume operacional justifique.

---

## 8. PLANO DE EXECUÇÃO INICIAL

Por favor, execute na seguinte ordem:

1. Gere o arquivo `PROJECT_CONTEXT.md` com o resumo executivo, regras e schema inicial do banco.
2. Defina o schema SQL do PostgreSQL para Supabase (incluindo `allowed_emails`, `profiles`, `ingredients`, `meals`, `orders`, `order_items`, `delivery_slots`, `credits`).
3. Crie a estrutura base do projeto Next.js com Tailwind CSS, configurando o tema Western/Laranja.
