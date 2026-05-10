-- ================================================================
-- СХЕМА БАЗЫ ДАННЫХ "У РАТУШИ"
-- ================================================================

-- ========== ТАБЛИЦА: tables ==========
CREATE TABLE tables (
    id int8 NOT NULL DEFAULT nextval('tables_id_seq'::regclass),
    number varchar(10) NOT NULL,
    seats int4 NOT NULL,
    zone_name varchar(100),
    x int4,
    y int4,
    is_active bool DEFAULT true,
    max_seats int4
);

-- ========== ТАБЛИЦА: bookings ==========
CREATE TABLE bookings (
    id int8 NOT NULL DEFAULT nextval('bookings_id_seq'::regclass),
    table_id int8 NOT NULL,
    customer_name varchar(100) NOT NULL,
    customer_phone varchar(20) NOT NULL,
    date date NOT NULL,
    time_slot varchar(5) NOT NULL,
    guests_count int4 NOT NULL,
    comment text,
    status varchar(20) DEFAULT 'new'::character varying,
    created_at timestamptz DEFAULT now()
);

-- ========== ТАБЛИЦА: menu_items ==========
CREATE TABLE menu_items (
    id int8 NOT NULL DEFAULT nextval('menu_items_id_seq'::regclass),
    name varchar(200) NOT NULL,
    category varchar(50) NOT NULL,
    price int4 NOT NULL,
    description text,
    photo_url text,
    is_active bool DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- ================================================================
-- RLS ПОЛИТИКИ
-- ================================================================

-- tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tables" ON tables FOR SELECT USING (true);
CREATE POLICY "Allow authenticated update tables" ON tables FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_insert" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "bookings_select" ON bookings FOR SELECT USING (true);
CREATE POLICY "bookings_update" ON bookings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "bookings_delete" ON bookings FOR DELETE USING (auth.role() = 'authenticated');

-- menu_items
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active menu" ON menu_items FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated admins can manage menu" ON menu_items FOR ALL USING (auth.uid() IS NOT NULL);