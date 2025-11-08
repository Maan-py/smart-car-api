# Smart Car IoT - Sistem Pengaman Mobil Berdasarkan Berat Maksimal

Sistem IoT untuk mengamankan mobil berdasarkan berat maksimal penumpang. Ketika berat melebihi batas maksimal, alarm akan berbunyi dan mobil tidak akan berjalan.

## 🏗️ Arsitektur Sistem

```
┌─────────────┐      MQTT      ┌─────────────┐      REST      ┌─────────────┐
│   Device    │ ──────────────> │     API     │ <───────────── │ Mobile App  │
│ (ESP32/ESP) │                 │  (Node.js)  │                │             │
└─────────────┘                 └─────────────┘                └─────────────┘
      │                                │                              │
      │                                │                              │
      └────────────────────────────────┼──────────────────────────────┘
                                       │
                                       ▼
                                ┌─────────────┐
                                │  Supabase   │
                                │  Database   │
                                └─────────────┘
```

## 📋 Fitur

- ✅ **Real-time Weight Monitoring**: Monitoring berat penumpang secara real-time
- ✅ **Overload Detection**: Deteksi otomatis ketika berat melebihi batas maksimal
- ✅ **Motor Control**: Mobil tidak akan berjalan jika overload
- ✅ **Alarm System**: Alarm berbunyi ketika overload terdeteksi
- ✅ **Mobile App Integration**: Atur berat maksimal dari mobile app
- ✅ **MQTT Communication**: Komunikasi real-time antara device dan API
- ✅ **Data Logging**: Log semua data berat ke database
- ✅ **Supabase Integration**: Database cloud untuk penyimpanan data

## 🛠️ Teknologi

- **Backend**: Node.js + Express
- **MQTT Broker**: Aedes (MQTT broker)
- **Database**: Supabase (PostgreSQL)
- **Communication**: MQTT (device ↔ API), REST API (mobile app ↔ API)

## 📦 Instalasi

### 1. Clone Repository

```bash
git clone <repository-url>
cd smart-car-iot/api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Buat file `.env` di folder `api/`:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# HiveMQ Cloud Configuration
HIVEMQ_URL=3577e8e742b544419045e2a77c8ec76d.s1.eu.hivemq.cloud
HIVEMQ_PORT=8883
HIVEMQ_USERNAME=your_hivemq_username
HIVEMQ_PASSWORD=your_hivemq_password
HIVEMQ_CLIENT_ID=smart-car-api

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 4. Setup Supabase Database

1. Buat project di [Supabase](https://supabase.com)
2. Jalankan SQL schema dari `api/supabase/schema.sql` di SQL Editor Supabase
3. Copy URL dan API keys ke file `.env`

### 5. Run Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server akan berjalan di:
- **REST API**: `http://localhost:3000`
- **MQTT Broker**: HiveMQ Cloud (TLS: 8883, WebSocket TLS: 8884)

## 📡 API Endpoints

### 1. Get Max Weight Setting
```http
GET /api/settings
```

**Response:**
```json
{
  "success": true,
  "data": {
    "max_weight": 500.00
  }
}
```

### 2. Update Max Weight Setting
```http
PUT /api/settings
Content-Type: application/json

{
  "max_weight": 600.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "max_weight": 600.00
  }
}
```

### 3. Get Device Status
```http
GET /api/status?device_id=esp32_001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "device_id": "esp32_001",
    "current_weight": 450.50,
    "is_overload": false,
    "motor_enabled": true,
    "alarm_active": false,
    "last_update": "2024-01-15T10:30:00Z"
  }
}
```

### 4. Get Weight Logs
```http
GET /api/logs?device_id=esp32_001&limit=100&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "weight": 450.50,
      "is_overload": false,
      "timestamp": "2024-01-15T10:30:00Z",
      "device_id": "esp32_001"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 1
  }
}
```

## 🔌 MQTT Topics

### Device → API

#### `device/weight/data`
Device mengirim data berat ke API.

**Payload:**
```json
{
  "device_id": "esp32_001",
  "weight": 450.50,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `device/status`
Device mengirim status update.

**Payload:**
```json
{
  "device_id": "esp32_001",
  "status": "online",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### API → Device

#### `device/control`
API mengirim perintah kontrol ke device.

**Payload:**
```json
{
  "device_id": "esp32_001",
  "motor_enabled": true,
  "alarm_enabled": false,
  "max_weight": 500.00,
  "current_weight": 450.50,
  "is_overload": false,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `device/settings`
API mengirim update pengaturan ke device.

**Payload:**
```json
{
  "max_weight": 600.00,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔄 Alur Kerja Sistem

1. **Device mengirim data berat** → MQTT topic `device/weight/data`
2. **API menerima data** → Process di `weightService.js`
3. **API cek logic**:
   - Jika `weight > max_weight` → `is_overload = true`
   - `motor_enabled = !is_overload` (motor mati jika overload)
   - `alarm_enabled = is_overload` (alarm aktif jika overload)
4. **API update database** → Simpan ke `weight_logs` dan `device_status`
5. **API kirim perintah ke device** → MQTT topic `device/control`
6. **Device eksekusi perintah** → Control motor DC dan alarm

## 📱 Mobile App Integration

Mobile app dapat:
- **Get/Set Max Weight**: `GET/PUT /api/settings`
- **Monitor Status**: `GET /api/status`
- **View Logs**: `GET /api/logs`

## 🗄️ Database Schema

### `settings`
- `id` (UUID)
- `max_weight` (DECIMAL)
- `updated_at` (TIMESTAMP)
- `updated_by` (TEXT)

### `weight_logs`
- `id` (UUID)
- `weight` (DECIMAL)
- `is_overload` (BOOLEAN)
- `timestamp` (TIMESTAMP)
- `device_id` (TEXT)

### `device_status`
- `id` (UUID)
- `device_id` (TEXT, UNIQUE)
- `current_weight` (DECIMAL)
- `is_overload` (BOOLEAN)
- `motor_enabled` (BOOLEAN)
- `alarm_active` (BOOLEAN)
- `last_update` (TIMESTAMP)

## 🔧 Development

### Project Structure
```
api/
├── config/
│   ├── supabase.js      # Supabase client
│   └── mqtt.js          # MQTT broker setup
├── services/
│   └── weightService.js # Business logic
├── routes/
│   └── api.js           # REST API routes
├── supabase/
│   └── schema.sql       # Database schema
├── server.js            # Main server
├── package.json
└── .env
```

## 📝 Notes

- Logic overload detection ada di `services/weightService.js`
- Semua komunikasi real-time menggunakan MQTT
- Database menggunakan Supabase (PostgreSQL)
- API dapat diakses dari mobile app via REST API

## 🚀 Next Steps

1. Implementasi device code (ESP32/ESP8266)
2. Develop mobile app
3. Testing end-to-end
4. Deploy ke production

## 📄 License

ISC

