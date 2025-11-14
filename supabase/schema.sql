-- ============================================================
-- SMART CAR IOT DATABASE SCHEMA (Supabase/PostgreSQL)
-- Pastikan ekstensi pgcrypto aktif untuk gen_random_uuid()
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. DEVICES TABLE (daftar perangkat ESP32)
-- ============================================================

CREATE TABLE IF NOT EXISTS devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL UNIQUE,   -- contoh: esp32-001
    name VARCHAR(100),
    location VARCHAR(100),
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen DESC);

-- ============================================================
-- 2. SETTINGS TABLE (batas berat, global atau per-device)
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id VARCHAR(100) NULL,               -- NULL = default global
    max_weight DECIMAL(10, 2) NOT NULL,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_settings_device FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_settings_device_id ON settings(device_id);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at DESC);

INSERT INTO settings (device_id, max_weight, updated_by) 
VALUES (NULL, 500.00, 'system')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. WEIGHT LOGS TABLE (riwayat data berat)
-- ============================================================

CREATE TABLE IF NOT EXISTS weight_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    weight DECIMAL(10, 2) NOT NULL,
    is_overload BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_payload JSONB NULL,
    CONSTRAINT fk_weight_logs_device FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_device_timestamp ON weight_logs(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_weight_logs_timestamp ON weight_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_weight_logs_overload ON weight_logs(is_overload);

-- ============================================================
-- 4. DEVICE STATUS TABLE (status real-time per device)
-- ============================================================

CREATE TABLE IF NOT EXISTS device_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL UNIQUE,
    current_weight DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_overload BOOLEAN NOT NULL DEFAULT FALSE,
    motor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    alarm_active BOOLEAN NOT NULL DEFAULT FALSE,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_device_status_device FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_status_last_update ON device_status(last_update DESC);

-- ============================================================
-- 5. EVENTS TABLE (overload & recovery logs)
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('overload', 'recovery', 'manual')),
    weight DECIMAL(10, 2),
    max_weight DECIMAL(10, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details JSONB NULL,
    CONSTRAINT fk_events_device FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- ============================================================
-- 6. CONTROL LOGS TABLE (riwayat command)
-- ============================================================

CREATE TABLE IF NOT EXISTS control_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    command_type VARCHAR(50) NOT NULL CHECK (
        command_type IN (
            'movement_control',
            'motor_control',
            'alarm_control',
            'settings_update',
            'manual_control'
        )
    ),
    command_data JSONB NOT NULL,
    sent_by VARCHAR(100) NOT NULL DEFAULT 'system',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_control_logs_device FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_control_logs_device ON control_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_sent_at ON control_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_control_logs_type ON control_logs(command_type);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_settings_updated_at 
    BEFORE UPDATE ON settings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE devices 
    SET last_seen = NOW() 
    WHERE device_id = NEW.device_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_device_last_seen_on_logs
    AFTER INSERT ON weight_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();
