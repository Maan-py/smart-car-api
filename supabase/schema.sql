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

-- Index untuk performa
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

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_settings_device_id ON settings(device_id);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at DESC);

-- Insert default global settings
INSERT INTO settings (device_id, max_weight, updated_by) 
VALUES (NULL, 500.00, 'system')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. LOG_WEIGHT TABLE (semua data berat dari sensor, via MQTT)
-- ============================================================

CREATE TABLE IF NOT EXISTS log_weight (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    weight DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('normal', 'overload')),
    raw_payload JSONB NULL,
    CONSTRAINT fk_log_weight_device FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_log_weight_device_timestamp ON log_weight(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_weight_timestamp ON log_weight(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_weight_status ON log_weight(status);

-- ============================================================
-- 4. CONTROL_LOG TABLE (semua perintah dari app/API ke ESP32)
-- ============================================================

CREATE TABLE IF NOT EXISTS control_log (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    
    -- Semua command termasuk forward, reverse, stop sudah di sini
    command VARCHAR(50) NOT NULL CHECK (command IN (
        'reset',
        'motor_on',
        'motor_off',
        'set_max_weight',
        'forward',
        'reverse',
        'stop'
    )),
    
    payload JSONB NULL,                         -- misal {"speed": 100}
    
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'ack', 'failed')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE NULL,
    
    CONSTRAINT fk_control_log_device FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_control_log_device ON control_log(device_id);
CREATE INDEX IF NOT EXISTS idx_control_log_created_at ON control_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_control_log_status ON control_log(status);
CREATE INDEX IF NOT EXISTS idx_control_log_command ON control_log(command);

-- ============================================================
-- 5. EVENTS TABLE (overload, recovery, device offline)
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL, 
        -- "overload", "recovered", "device_offline", dll
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_events_device FOREIGN KEY (device_id) 
        REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- ============================================================
-- Function untuk update timestamp otomatis
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger untuk update updated_at di settings
CREATE TRIGGER update_settings_updated_at 
    BEFORE UPDATE ON settings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Function untuk update last_seen di devices
-- ============================================================

CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE devices 
    SET last_seen = NOW() 
    WHERE device_id = NEW.device_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger untuk update last_seen ketika ada log_weight baru
CREATE TRIGGER update_device_last_seen_on_log
    AFTER INSERT ON log_weight
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();
