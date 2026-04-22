-- Схема базы данных для ресторана с системой бронирования

-- Таблица столиков
CREATE TABLE tables (
    id SERIAL PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    seats INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    zone_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Таблица бронирований
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    table_id INTEGER REFERENCES tables(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    guests_count INTEGER NOT NULL,
    comment TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Включение Realtime для таблиц
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- Вставка данных о столиках
INSERT INTO tables (number, seats, x, y, zone_name) VALUES
-- Ряд 1 у окна - 2 места
('1', 2, 100, 100, 'у окна'),
('2', 2, 300, 100, 'у окна'),
('3', 2, 500, 100, 'у окна'),
-- Ряд 2 центр - 4 места
('4', 4, 80, 250, 'центр'),
('5', 4, 220, 250, 'центр'),
('6', 4, 360, 250, 'центр'),
('7', 4, 500, 250, 'центр'),
-- Ряд 2 - столик 8 на 6 мест (выделенный)
('8', 6, 640, 250, 'центр'),
-- Ряд 3 у стены - 2 места
('9', 2, 100, 400, 'у стены'),
('10', 2, 300, 400, 'у стены'),
('11', 2, 500, 400, 'у стены'),
('12', 2, 700, 400, 'у стены'),
-- VIP-зона
('13', 6, 650, 80, 'VIP'),
('14', 6, 720, 150, 'VIP'),
('15', 8, 700, 250, 'VIP'),
-- Барная стойка
('B1', 1, 100, 520, 'бар'),
('B2', 1, 250, 520, 'бар'),
('B3', 1, 400, 520, 'бар'),
('B4', 1, 550, 520, 'бар');

-- Создание политики RLS для bookings (чтение для всех, запись только для авторизованных)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать бронирования
CREATE POLICY "Allow public read bookings" ON bookings
    FOR SELECT USING (true);

-- Полизация: только авторизованные могут добавлять/обновлять
CREATE POLICY "Allow authenticated insert bookings" ON bookings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update bookings" ON bookings
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete bookings" ON bookings
    FOR DELETE USING (auth.role() = 'authenticated');

-- Включение RLS и политики для tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated update tables" ON tables
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Создание индекса для быстрого поиска бронирований по дате и телефону
CREATE INDEX idx_bookings_date_phone ON bookings (date, customer_phone);
CREATE INDEX idx_bookings_table_date_time ON bookings (table_id, date, time_slot);