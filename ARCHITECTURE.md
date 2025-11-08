# Arsitektur Sistem - Smart Car IoT

## Overview

Sistem IoT untuk mengamankan mobil berdasarkan berat maksimal penumpang dengan fitur:
- Real-time weight monitoring
- Overload detection
- Motor control (mobil tidak berjalan jika overload)
- Alarm system (alarm berbunyi jika overload)
- Mobile app integration
- MQTT communication
- Supabase database

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MOBILE APP                               │
│  (React Native / Flutter / Native)                              │
│                                                                  │
│  - Get/Set Max Weight                                           │
│  - Monitor Real-time Status                                     │
│  - View Weight Logs                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ REST API (HTTP/HTTPS)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API SERVER                               │
│                    (Node.js + Express)                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints:                                     │  │
│  │  - GET  /api/settings    (Get max weight)               │  │
│  │  - PUT  /api/settings    (Update max weight)            │  │
│  │  - GET  /api/status      (Get device status)            │  │
│  │  - GET  /api/logs        (Get weight logs)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MQTT Broker (Aedes):                                     │  │
│  │  - TCP Port: 1883                                         │  │
│  │  - WebSocket Port: 8883                                   │  │
│  │                                                            │  │
│  │  Topics:                                                   │  │
│  │  - device/weight/data  (Device → API)                    │  │
│  │  - device/control      (API → Device)                    │  │
│  │  - device/settings     (API → Device)                    │  │
│  │  - device/status       (Device → API)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Business Logic (weightService.js):                       │  │
│  │                                                            │  │
│  │  processWeightData():                                     │  │
│  │    1. Receive weight from device                         │  │
│  │    2. Get max_weight from database                        │  │
│  │    3. Check: weight > max_weight?                         │  │
│  │    4. Calculate:                                          │  │
│  │       - is_overload = weight > max_weight                 │  │
│  │       - motor_enabled = !is_overload                      │  │
│  │       - alarm_enabled = is_overload                       │  │
│  │    5. Save to database (logs + status)                   │  │
│  │    6. Send control command to device                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         │ MQTT                          │ Database (Supabase)
         │                               │
         ▼                               ▼
┌──────────────────┐          ┌──────────────────────────┐
│   IOT DEVICE     │          │     SUPABASE DB          │
│  (ESP32/ESP8266) │          │                          │
│                  │          │  Tables:                 │
│  Hardware:       │          │  - settings              │
│  - Weight Sensor │          │  - weight_logs           │
│  - Motor DC      │          │  - device_status         │
│  - Alarm/Buzzer  │          │                          │
│  - WiFi Module   │          │  Features:                │
│                  │          │  - Real-time sync         │
│  Functions:      │          │  - REST API               │
│  - Read weight   │          │  - Webhooks              │
│  - Control motor │          │  - Row Level Security    │
│  - Control alarm │          │                          │
│  - MQTT client   │          │                          │
└──────────────────┘          └──────────────────────────┘
```

## Data Flow

### 1. Weight Monitoring Flow

```
Device (ESP32)
    │
    │ Read weight from sensor (HX711)
    │
    ▼
Publish to MQTT: device/weight/data
    │
    │ { "device_id": "esp32_001", "weight": 550.00 }
    │
    ▼
API Server (MQTT Broker)
    │
    │ Receive message
    │
    ▼
weightService.processWeightData()
    │
    │ 1. Get max_weight from DB
    │ 2. Check: 550 > 500? → YES
    │ 3. Calculate:
    │    - is_overload = true
    │    - motor_enabled = false
    │    - alarm_enabled = true
    │
    ▼
Save to Database
    │
    │ - Insert to weight_logs
    │ - Update device_status
    │
    ▼
Publish to MQTT: device/control
    │
    │ { "motor_enabled": false, "alarm_enabled": true, ... }
    │
    ▼
Device (ESP32)
    │
    │ Receive control command
    │
    ▼
Execute Commands
    │
    │ - Motor OFF (digitalWrite LOW)
    │ - Alarm ON (digitalWrite HIGH)
```

### 2. Update Max Weight Flow

```
Mobile App
    │
    │ User changes max weight to 600kg
    │
    ▼
PUT /api/settings
    │
    │ { "max_weight": 600.00 }
    │
    ▼
API Server
    │
    │ 1. Validate input
    │ 2. Insert to settings table
    │ 3. Publish to MQTT: device/settings
    │
    ▼
Database (Supabase)
    │
    │ Save new max_weight
    │
    ▼
MQTT: device/settings
    │
    │ { "max_weight": 600.00 }
    │
    ▼
Device (ESP32)
    │
    │ Update local max_weight variable
```

### 3. Mobile App Monitoring Flow

```
Mobile App
    │
    │ User opens status screen
    │
    ▼
GET /api/status?device_id=esp32_001
    │
    ▼
API Server
    │
    │ Query device_status table
    │
    ▼
Database (Supabase)
    │
    │ Return latest status
    │
    ▼
API Response
    │
    │ {
    │   "current_weight": 450.50,
    │   "is_overload": false,
    │   "motor_enabled": true,
    │   "alarm_active": false
    │ }
    │
    ▼
Mobile App
    │
    │ Display status to user
```

## Database Schema

### settings
Menyimpan pengaturan berat maksimal.

| Column | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| max_weight | DECIMAL(10,2) | Berat maksimal (kg) |
| updated_at | TIMESTAMP | Waktu update terakhir |
| updated_by | TEXT | Siapa yang update |

### weight_logs
Menyimpan log semua pembacaan berat.

| Column | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| weight | DECIMAL(10,2) | Berat yang dibaca (kg) |
| is_overload | BOOLEAN | Apakah overload? |
| timestamp | TIMESTAMP | Waktu pembacaan |
| device_id | TEXT | ID device |

### device_status
Menyimpan status real-time setiap device.

| Column | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| device_id | TEXT (UNIQUE) | ID device |
| current_weight | DECIMAL(10,2) | Berat saat ini |
| is_overload | BOOLEAN | Status overload |
| motor_enabled | BOOLEAN | Motor enabled? |
| alarm_active | BOOLEAN | Alarm aktif? |
| last_update | TIMESTAMP | Update terakhir |

## MQTT Topics

### Device → API

#### `device/weight/data`
Device mengirim data berat secara berkala (1-5 detik).

**Payload:**
```json
{
  "device_id": "esp32_001",
  "weight": 450.50,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `device/status`
Device mengirim status update (opsional).

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
API mengirim perintah kontrol setelah memproses data berat.

**Payload:**
```json
{
  "device_id": "esp32_001",
  "motor_enabled": false,
  "alarm_enabled": true,
  "max_weight": 500.00,
  "current_weight": 550.00,
  "is_overload": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Logic:**
- `motor_enabled = !is_overload`
- `alarm_enabled = is_overload`

#### `device/settings`
API mengirim update pengaturan ketika max_weight diubah.

**Payload:**
```json
{
  "max_weight": 600.00,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Business Logic

### Overload Detection

```javascript
const maxWeight = await getMaxWeight(); // From database
const currentWeight = parseFloat(weightData.weight);
const isOverload = currentWeight > maxWeight;

const motorEnabled = !isOverload;  // Motor mati jika overload
const alarmEnabled = isOverload;    // Alarm aktif jika overload
```

### Rules

1. **Motor Control:**
   - Motor ENABLED jika `weight ≤ max_weight`
   - Motor DISABLED jika `weight > max_weight`

2. **Alarm Control:**
   - Alarm OFF jika `weight ≤ max_weight`
   - Alarm ON jika `weight > max_weight`

3. **Data Logging:**
   - Setiap pembacaan berat disimpan ke `weight_logs`
   - Status device selalu diupdate di `device_status`

4. **Real-time Updates:**
   - Semua perubahan langsung dikirim via MQTT
   - Mobile app bisa query status real-time via REST API

## Security Considerations

1. **MQTT:**
   - Saat ini tidak ada authentication (untuk development)
   - Untuk production, tambahkan username/password atau TLS

2. **REST API:**
   - Saat ini tidak ada authentication
   - Untuk production, tambahkan JWT atau API key

3. **Database:**
   - Gunakan Row Level Security (RLS) di Supabase
   - Jangan expose service_role key ke client

4. **Network:**
   - Gunakan VPN atau secure tunnel untuk MQTT
   - Gunakan HTTPS untuk REST API

## Scalability

1. **Multiple Devices:**
   - Setiap device punya unique `device_id`
   - Status disimpan per device di `device_status`
   - Logs bisa difilter by `device_id`

2. **High Frequency:**
   - Database menggunakan index untuk performa
   - Logs bisa di-archive setelah periode tertentu
   - Consider using time-series database untuk logs

3. **MQTT Broker:**
   - Aedes bisa handle banyak concurrent connections
   - Untuk production, consider menggunakan Mosquitto atau cloud MQTT

## Monitoring & Debugging

1. **API Logs:**
   - Console logs untuk semua operations
   - Error logging untuk troubleshooting

2. **Database:**
   - Supabase dashboard untuk melihat data real-time
   - Query logs untuk debugging

3. **MQTT:**
   - Monitor published messages di console
   - Use MQTT client tools untuk testing

## Deployment

### Development
- Run locally dengan `npm run dev`
- MQTT broker di localhost:1883
- Supabase project untuk development

### Production
- Deploy API ke cloud (Heroku, Railway, VPS)
- Update MQTT server IP di device
- Setup domain untuk API
- Enable HTTPS
- Setup authentication
- Monitor dengan logging service

