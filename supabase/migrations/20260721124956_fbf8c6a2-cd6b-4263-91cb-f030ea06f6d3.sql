
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  monthly_budget NUMERIC(12,2) NOT NULL DEFAULT 30000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products readable by all" ON public.products FOR SELECT USING (true);
CREATE POLICY "authenticated can add products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);

-- Price reports
CREATE TABLE public.price_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  city TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  still_accurate_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX price_reports_product_idx ON public.price_reports(product_id, created_at DESC);
GRANT SELECT ON public.price_reports TO anon, authenticated;
GRANT INSERT, UPDATE ON public.price_reports TO authenticated;
GRANT ALL ON public.price_reports TO service_role;
ALTER TABLE public.price_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports readable by all" ON public.price_reports FOR SELECT USING (true);
CREATE POLICY "authenticated can add report" ON public.price_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);

-- Function to increment still_accurate_count (any authenticated user can confirm)
CREATE OR REPLACE FUNCTION public.confirm_price_report(_report_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  UPDATE public.price_reports
    SET still_accurate_count = still_accurate_count + 1
    WHERE id = _report_id
    RETURNING still_accurate_count INTO new_count;
  RETURN new_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_price_report(UUID) TO authenticated;

-- Shopping lists
CREATE TABLE public.shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My List',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT ALL ON public.shopping_lists TO service_role;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lists" ON public.shopping_lists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Shopping list items
CREATE TABLE public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX list_items_list_idx ON public.shopping_list_items(list_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list_items TO authenticated;
GRANT ALL ON public.shopping_list_items TO service_role;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own list items" ON public.shopping_list_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));

-- Chat messages (single ongoing conversation per user)
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_user_idx ON public.chat_messages(user_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed common products
INSERT INTO public.products (name, category) VALUES
  ('Basmati Rice (1kg)', 'Grocery'),
  ('Wheat Flour (10kg)', 'Grocery'),
  ('Sugar (1kg)', 'Grocery'),
  ('Cooking Oil (1L)', 'Grocery'),
  ('Ghee (1kg)', 'Grocery'),
  ('Red Lentils / Masoor Dal (1kg)', 'Grocery'),
  ('Chickpeas / Chana (1kg)', 'Grocery'),
  ('Tea / Chai (500g)', 'Grocery'),
  ('Salt (1kg)', 'Grocery'),
  ('Milk (1L)', 'Dairy'),
  ('Yogurt / Dahi (1kg)', 'Dairy'),
  ('Eggs (dozen)', 'Dairy'),
  ('Butter (250g)', 'Dairy'),
  ('Cheese Slice (200g)', 'Dairy'),
  ('Onions (1kg)', 'Produce'),
  ('Potatoes (1kg)', 'Produce'),
  ('Tomatoes (1kg)', 'Produce'),
  ('Bananas (1 dozen)', 'Produce'),
  ('Apples (1kg)', 'Produce'),
  ('Chicken (1kg)', 'Produce'),
  ('Beef (1kg)', 'Produce'),
  ('Detergent Powder (1kg)', 'Household'),
  ('Dishwash Liquid (500ml)', 'Household'),
  ('Toilet Paper (4 rolls)', 'Household'),
  ('Soap Bar', 'Household'),
  ('Toothpaste (100g)', 'Household');
