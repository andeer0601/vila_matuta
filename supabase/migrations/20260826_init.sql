-- ==============================================================================
-- VILA MATUTA - INITIAL DATABASE SCHEMA
-- PostgreSQL / Supabase
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. WHITELIST (allowed_emails)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allowed_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup during signup
CREATE INDEX IF NOT EXISTS idx_allowed_emails_email ON public.allowed_emails(LOWER(email));

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES (profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    neighborhood TEXT,
    complement TEXT,
    city TEXT,
    state TEXT DEFAULT 'SP',
    dietary_restrictions TEXT[] DEFAULT '{}',
    dietary_notes TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ------------------------------------------------------------------------------
-- 3. INGREDIENTS & COMPLETE DISHES (ingredients)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('base', 'protein', 'side', 'complete_dish')),
    portion_grams INTEGER NOT NULL DEFAULT 100, -- Maximum gram per portion for grocery list
    unit TEXT NOT NULL DEFAULT 'g',
    description TEXT,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_category ON public.ingredients(category);

-- ------------------------------------------------------------------------------
-- 4. PACKAGES & PLANS (packages)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    meal_count INTEGER NOT NULL CHECK (meal_count > 0),
    total_price NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. CUSTOMER MEAL CREDITS (customer_credits)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    available_meals INTEGER NOT NULL DEFAULT 0 CHECK (available_meals >= 0),
    total_purchased INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. SHIFT CONFIGURATIONS (shift_configs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 1 = Monday ... 6 = Saturday
    shift_name TEXT NOT NULL CHECK (shift_name IN ('Manhã', 'Tarde', 'Noite')),
    max_orders_capacity INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT unique_day_shift UNIQUE (day_of_week, shift_name)
);

-- ------------------------------------------------------------------------------
-- 7. ORDERS & DELIVERIES (orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL DEFAULT 'single' CHECK (order_type IN ('single', 'package', 'credit_usage')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'preparing', 'in_delivery', 'delivered', 'cancelled')),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    quantity_meals INTEGER NOT NULL DEFAULT 1 CHECK (quantity_meals > 0),
    delivery_date DATE,
    delivery_shift TEXT CHECK (delivery_shift IN ('Manhã', 'Tarde', 'Noite')),
    payment_method TEXT DEFAULT 'pix' CHECK (payment_method IN ('pix', 'credit_card', 'credits')),
    infinitepay_tx_id TEXT,
    infinitepay_checkout_url TEXT,
    infinitepay_pix_code TEXT,
    shipping_address_snapshot JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ------------------------------------------------------------------------------
-- 8. ORDER ITEMS (order_items)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL DEFAULT 'custom' CHECK (item_type IN ('custom', 'complete_dish')),
    name TEXT NOT NULL,
    base_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
    protein_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
    side1_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
    side2_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
    complete_dish_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ------------------------------------------------------------------------------
-- 9. TRIGGERS & BUSINESS RULES ENFORCEMENT
-- ------------------------------------------------------------------------------

-- Trigger function: Check Whitelist before Supabase Auth User Creation
CREATE OR REPLACE FUNCTION public.check_user_whitelist()
RETURNS TRIGGER AS $$
DECLARE
    matched_role TEXT;
BEGIN
    SELECT role INTO matched_role
    FROM public.allowed_emails
    WHERE LOWER(email) = LOWER(NEW.email);

    IF matched_role IS NULL THEN
        RAISE EXCEPTION 'Acesso restrito: O e-mail % ainda não está autorizado para a fase fechada.', NEW.email;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: Automatically create profile upon user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
BEGIN
    SELECT role INTO assigned_role
    FROM public.allowed_emails
    WHERE LOWER(email) = LOWER(NEW.email);

    IF assigned_role IS NULL THEN
        assigned_role := 'customer';
    END IF;

    INSERT INTO public.profiles (id, email, role, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        assigned_role,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

    -- Create customer_credits record
    INSERT INTO public.customer_credits (user_id, available_meals, total_purchased)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate auth trigger (executed on Supabase auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_customer_credits_timestamp
    BEFORE UPDATE ON public.customer_credits
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allowed Emails: Only admins can manage, anyone can check existence via RPC
CREATE POLICY "Admins can view and edit whitelist"
    ON public.allowed_emails
    FOR ALL
    USING (public.is_admin());

-- Profiles: Users can view & edit their own profile; Admins have full access
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id OR public.is_admin());

-- Ingredients: Everyone can read available ingredients; Admins can edit
CREATE POLICY "Anyone can view ingredients"
    ON public.ingredients
    FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage ingredients"
    ON public.ingredients
    FOR ALL
    USING (public.is_admin());

-- Packages: Everyone can read active packages; Admins can edit
CREATE POLICY "Anyone can view active packages"
    ON public.packages
    FOR SELECT
    USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins can manage packages"
    ON public.packages
    FOR ALL
    USING (public.is_admin());

-- Customer Credits: Users see own credits; Admins can manage
CREATE POLICY "Users view own credits"
    ON public.customer_credits
    FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage credits"
    ON public.customer_credits
    FOR ALL
    USING (public.is_admin());

-- Shift Configs: Anyone can view shifts; Admins can edit
CREATE POLICY "Anyone can view shifts"
    ON public.shift_configs
    FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage shifts"
    ON public.shift_configs
    FOR ALL
    USING (public.is_admin());

-- Orders: Users can view and insert own orders; Admins have full access
CREATE POLICY "Users view own orders"
    ON public.orders
    FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users create own orders"
    ON public.orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update any orders"
    ON public.orders
    FOR ALL
    USING (public.is_admin());

-- Order Items: Users view their own order items; Admins have full access
CREATE POLICY "Users view own order items"
    ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND (orders.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Users insert own order items"
    ON public.order_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND orders.user_id = auth.uid()
        )
    );

-- Enable Realtime on orders table for instant payment updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
