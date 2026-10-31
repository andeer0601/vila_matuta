-- ==============================================================================
-- VILA MATUTA - SEED DATA
-- Initial Ingredients, Packages, Shifts and Whitelist
-- ==============================================================================

-- 1. EXEMPLOS FICTÍCIOS: substitua por convites verificados apenas no ambiente real.
-- Nunca use contas fictícias como administradores de produção.
INSERT INTO public.allowed_emails (email, role) VALUES
    ('anderson@example.invalid', 'admin'),
    ('admin-secondary@example.invalid', 'admin'),
    ('mariana@example.invalid', 'customer'),
    ('lucas@example.invalid', 'customer')
ON CONFLICT (email) DO NOTHING;

-- 2. INGREDIENTES: BASES (Porção: 150g no cálculo de compras)
INSERT INTO public.ingredients (name, category, portion_grams, unit, is_available) VALUES
    ('Arroz Branco', 'base', 150, 'g', true),
    ('Arroz Integral', 'base', 150, 'g', true),
    ('Feijão Carioca', 'base', 150, 'g', true),
    ('Feijão Preto', 'base', 150, 'g', true),
    ('Macarrão Penne', 'base', 150, 'g', true),
    ('Espaguete', 'base', 150, 'g', true);

-- 3. INGREDIENTES: PROTEÍNAS (Porção: 100g no cálculo de compras)
INSERT INTO public.ingredients (name, category, portion_grams, unit, is_available) VALUES
    ('Frango Grelhado', 'protein', 100, 'g', true),
    ('Frango Acebolado', 'protein', 100, 'g', true),
    ('Filé de Frango À Parmegiana', 'protein', 100, 'g', true),
    ('Mignon Suíno', 'protein', 100, 'g', true),
    ('Pernil Cozido e Desfiado', 'protein', 100, 'g', true),
    ('Pernil Desfiado com Barbecue', 'protein', 100, 'g', true),
    ('Omelete Recheado (Queijo)', 'protein', 100, 'g', true),
    ('Omelete Recheado (Presunto e Queijo)', 'protein', 100, 'g', true),
    ('Linguiça Toscana', 'protein', 100, 'g', true),
    ('Ovos com Bacon', 'protein', 100, 'g', true),
    ('Carne de Panela (Acém)', 'protein', 100, 'g', true),
    ('Sobrecoxa Desossada e Assada', 'protein', 100, 'g', true),
    ('Hambúrguer Artesanal', 'protein', 100, 'g', true),
    ('Panqueca de Carne Moída', 'protein', 100, 'g', true),
    ('Panqueca de Brócolis', 'protein', 100, 'g', true),
    ('Panqueca de Presunto e Queijo', 'protein', 100, 'g', true),
    ('Carne Moída Refogada', 'protein', 100, 'g', true),
    ('Almôndegas ao Sugo', 'protein', 100, 'g', true),
    ('Strogonoff de Carne', 'protein', 100, 'g', true),
    ('Strogonoff de Frango', 'protein', 100, 'g', true),
    ('Strogonoff de Palmito', 'protein', 100, 'g', true);

-- 4. INGREDIENTES: LEGUMES, VERDURAS & ACOMPANHAMENTOS (Porção: 80g no cálculo de compras)
INSERT INTO public.ingredients (name, category, portion_grams, unit, is_available) VALUES
    ('Brócolis', 'side', 80, 'g', true),
    ('Couve-flor', 'side', 80, 'g', true),
    ('Cenoura', 'side', 80, 'g', true),
    ('Batata Rústica', 'side', 80, 'g', true),
    ('Vagem', 'side', 80, 'g', true),
    ('Abobrinha', 'side', 80, 'g', true),
    ('Repolho', 'side', 80, 'g', true),
    ('Pimentão', 'side', 80, 'g', true),
    ('Batata Doce', 'side', 80, 'g', true),
    ('Farofa Artesanal', 'side', 80, 'g', true),
    ('Creme de Milho', 'side', 80, 'g', true),
    ('Purê de Batata', 'side', 80, 'g', true),
    ('Purê de Abóbora Cabotiá', 'side', 80, 'g', true);

-- 5. PRATOS COMPLETOS (Porção fechada / especial ~400g)
INSERT INTO public.ingredients (name, category, portion_grams, unit, is_available, description) VALUES
    ('Penne À Bolonhesa', 'complete_dish', 400, 'g', true, 'Massa penne com molho bolonhesa artesanal de carne selecionada'),
    ('Espaguete À Bolonhesa', 'complete_dish', 400, 'g', true, 'Espaguete tradicional com generoso molho bolonhesa'),
    ('Escondidinho de Carne Moída', 'complete_dish', 400, 'g', true, 'Purê cremoso de mandioca gratinado com carne moída temperada'),
    ('Escondidinho de Calabresa', 'complete_dish', 400, 'g', true, 'Purê especial com recheio de calabresa defumada'),
    ('Escondidinho de Brócolis', 'complete_dish', 400, 'g', true, 'Opção vegetariana com brócolis frescos e queijo'),
    ('Frango Xadrez', 'complete_dish', 400, 'g', true, 'Cubos de frango com pimentões e molho especial. Acompanha arroz'),
    ('Nhoque À Bolonhesa', 'complete_dish', 400, 'g', true, 'Nhoque de batata artesanal com molho bolonhesa'),
    ('Nhoque de Brócolis com Molho Branco', 'complete_dish', 400, 'g', true, 'Nhoque artesanal de brócolis com molho branco cremoso'),
    ('Feijuca Completa', 'complete_dish', 450, 'g', true, 'Feijoada especial com calabresa e bacon. Acompanha arroz e farofa artesanal');

-- 6. PACOTES E KITS PREDEFINIDOS (Tabela de Valores)
INSERT INTO public.packages (name, meal_count, total_price, unit_price, description, is_active) VALUES
    ('Kit 10 Refeições', 10, 180.00, 18.00, 'Perfeito para 2 semanas de almoço prático e saudável.', true),
    ('Kit 20 Refeições', 20, 320.00, 16.00, 'Economia e conveniência para quase o mês todo.', true),
    ('Kit 30 Refeições', 30, 450.00, 15.00, 'Nosso melhor custo-benefício para quem quer tranquilidade diária.', true);

-- 7. CONFIGURAÇÃO PADRÃO DE TURNOS SEMANAIS (0 = Domingo ... 6 = Sábado)
-- Configurando Manhã e Noite ativos por padrão com capacidade de 3 pedidos cada
INSERT INTO public.shift_configs (day_of_week, shift_name, max_orders_capacity, is_active) VALUES
    (1, 'Manhã', 3, true),
    (1, 'Noite', 3, true),
    (2, 'Manhã', 3, true),
    (2, 'Noite', 3, true),
    (3, 'Manhã', 3, true),
    (3, 'Noite', 3, true),
    (4, 'Manhã', 3, true),
    (4, 'Noite', 3, true),
    (5, 'Manhã', 3, true),
    (5, 'Noite', 3, true),
    (6, 'Manhã', 3, true),
    (6, 'Noite', 3, true),
    (0, 'Manhã', 3, false), -- Domingo fechado por padrão
    (0, 'Noite', 3, false)
ON CONFLICT (day_of_week, shift_name) DO NOTHING;
