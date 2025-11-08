# API Documentation - Smart Car IoT

## Base URL

```
http://localhost:3000/api
```

## Authentication

Saat ini API tidak menggunakan authentication. Untuk production, disarankan menambahkan JWT atau API key authentication.

---

## Endpoints Overview

| Area      | Method | Endpoint                | Fungsi                      |
| --------- | ------ | ----------------------- | --------------------------- |
| Device    | POST   | /api/devices/register   | Registrasi ESP32            |
| Device    | GET    | /api/devices/:id/status | Status & last telemetry     |
| Settings  | GET    | /api/settings           | Ambil max_weight            |
| Settings  | POST   | /api/settings           | Ubah max_weight (push MQTT) |
| Telemetry | GET    | /api/telemetry          | Riwayat berat               |
| Events    | GET    | /api/events             | Log overload & recovery     |
| Control   | POST   | /api/control            | Kirim command via MQTT      |
| Control   | GET    | /api/control-log        | Riwayat command             |

---

## Endpoints Detail

### 1. Health Check

**GET** `/health`

Cek status server.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "Smart Car IoT API"
}
```

---

### 2. Device Registration

**POST** `/api/devices/register`

Registrasi ESP32 device.

**Request Body:**

```json
{
  "device_id": "esp32_001",
  "device_name": "Car 1",
  "device_type": "ESP32",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "firmware_version": "1.0.0"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "device_id": "esp32_001",
    "device_name": "Car 1",
    "device_type": "ESP32",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "firmware_version": "1.0.0",
    "registered_at": "2024-01-15T10:30:00.000Z",
    "last_seen": "2024-01-15T10:30:00.000Z",
    "is_active": true
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "device_id is required"
}
```

---

### 3. Get Device Status with Telemetry

**GET** `/api/devices/:id/status`

Mendapatkan status real-time dan last telemetry dari device.

**Path Parameters:**

- `id` (required) - Device ID

**Response:**

```json
{
  "success": true,
  "data": {
    "device_id": "esp32_001",
    "current_weight": 450.5,
    "is_overload": false,
    "motor_enabled": true,
    "alarm_active": false,
    "last_update": "2024-01-15T10:30:00.000Z",
    "last_telemetry": {
      "id": "uuid",
      "weight": 450.5,
      "is_overload": false,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "device_id": "esp32_001"
    }
  }
}
```

---

### 4. Get Max Weight Setting

**GET** `/api/settings`

Mendapatkan pengaturan berat maksimal saat ini.

**Response:**

```json
{
  "success": true,
  "data": {
    "max_weight": 500.0
  }
}
```

---

### 5. Update Max Weight Setting

**POST** `/api/settings`

Mengupdate pengaturan berat maksimal. Update ini akan langsung dikirim ke semua device via MQTT.

**Request Body:**

```json
{
  "max_weight": 600.0
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "max_weight": 600.0
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "max_weight harus berupa angka positif"
}
```

---

### 6. Get Telemetry (Weight Logs)

**GET** `/api/telemetry?device_id=esp32_001&limit=100&offset=0`

Mendapatkan riwayat data berat dengan pagination.

**Query Parameters:**

- `device_id` (optional) - Filter by device ID
- `limit` (optional) - Jumlah data per page. Default: `100`
- `offset` (optional) - Offset untuk pagination. Default: `0`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "weight": 450.5,
      "is_overload": false,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "device_id": "esp32_001"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "weight": 520.0,
      "is_overload": true,
      "timestamp": "2024-01-15T10:31:00.000Z",
      "device_id": "esp32_001"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 2
  }
}
```

---

### 7. Get Events

**GET** `/api/events?device_id=esp32_001&limit=100&offset=0`

Mendapatkan log events (overload & recovery).

**Query Parameters:**

- `device_id` (optional) - Filter by device ID
- `limit` (optional) - Jumlah data per page. Default: `100`
- `offset` (optional) - Offset untuk pagination. Default: `0`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "device_id": "esp32_001",
      "event_type": "overload",
      "weight": 550.0,
      "max_weight": 500.0,
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "uuid",
      "device_id": "esp32_001",
      "event_type": "recovery",
      "weight": 450.0,
      "max_weight": 500.0,
      "timestamp": "2024-01-15T10:35:00.000Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 2
  }
}
```

**Event Types:**

- `overload` - Terjadi ketika berat melebihi max_weight
- `recovery` - Terjadi ketika berat kembali di bawah max_weight

---

### 8. Send Control Command

**POST** `/api/control`

Mengirim command ke device via MQTT.

**Request Body:**

```json
{
  "device_id": "esp32_001",
  "motor_enabled": false,
  "alarm_enabled": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "command": {
      "device_id": "esp32_001",
      "motor_enabled": false,
      "alarm_enabled": true,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "device_id is required"
}
```

---

### 9. Get Control Logs

**GET** `/api/control-log?device_id=esp32_001&limit=100&offset=0`

Mendapatkan riwayat command yang dikirim ke device.

**Query Parameters:**

- `device_id` (optional) - Filter by device ID
- `limit` (optional) - Jumlah data per page. Default: `100`
- `offset` (optional) - Offset untuk pagination. Default: `0`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "device_id": "esp32_001",
      "command_type": "motor_control",
      "command_data": {
        "device_id": "esp32_001",
        "motor_enabled": false,
        "alarm_enabled": true,
        "timestamp": "2024-01-15T10:30:00.000Z"
      },
      "sent_at": "2024-01-15T10:30:00.000Z",
      "sent_by": "mobile_app"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 1
  }
}
```

**Command Types:**

- `motor_control` - Control motor dan alarm
- `alarm_control` - Control alarm saja
- `settings_update` - Update settings
- `manual_control` - Manual control dari mobile app

---

## MQTT Topics

### Device → API

#### `device/weight/data`

Device mengirim data berat ke API.

**Payload Format:**

```json
{
  "device_id": "esp32_001",
  "weight": 450.5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Frequency:** Disarankan setiap 1-5 detik

---

#### `device/status`

Device mengirim status update (opsional).

**Payload Format:**

```json
{
  "device_id": "esp32_001",
  "status": "online",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### API → Device

#### `device/control`

API mengirim perintah kontrol ke device setelah memproses data berat.

**Payload Format:**

```json
{
  "device_id": "esp32_001",
  "motor_enabled": true,
  "alarm_enabled": false,
  "max_weight": 500.0,
  "current_weight": 450.5,
  "is_overload": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Fields:**

- `motor_enabled` (boolean) - `true` jika motor boleh berjalan, `false` jika harus mati
- `alarm_enabled` (boolean) - `true` jika alarm harus berbunyi, `false` jika mati
- `is_overload` (boolean) - `true` jika berat melebihi maksimal
- `max_weight` (number) - Berat maksimal saat ini
- `current_weight` (number) - Berat saat ini

**Logic:**

- Jika `is_overload = true`:
  - `motor_enabled = false` (mobil tidak boleh berjalan)
  - `alarm_enabled = true` (alarm berbunyi)
- Jika `is_overload = false`:
  - `motor_enabled = true` (mobil boleh berjalan)
  - `alarm_enabled = false` (alarm mati)

---

#### `device/settings`

API mengirim update pengaturan ketika max_weight diubah dari mobile app.

**Payload Format:**

```json
{
  "max_weight": 600.0,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Business Logic

### Overload Detection

Logic utama ada di `services/weightService.js`:

```javascript
const isOverload = currentWeight > maxWeight;
const motorEnabled = !isOverload; // Motor mati jika overload
const alarmEnabled = isOverload; // Alarm aktif jika overload
```

### Flow Diagram

```
Device reads weight
    ↓
Publish to MQTT: device/weight/data
    ↓
API receives & processes
    ↓
Check: weight > max_weight?
    ↓
    ├─ YES → is_overload = true
    │         motor_enabled = false
    │         alarm_enabled = true
    │
    └─ NO  → is_overload = false
              motor_enabled = true
              alarm_enabled = false
    ↓
Save to database (weight_logs & device_status)
    ↓
Publish to MQTT: device/control
    ↓
Device receives & executes
    ↓
Motor & Alarm controlled
```

---

## Error Handling

Semua endpoint mengembalikan format response yang konsisten:

**Success:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**

```json
{
  "success": false,
  "error": "Error message"
}
```

**HTTP Status Codes:**

- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

---

## Testing dengan cURL

### Get Max Weight

```bash
curl http://localhost:3000/api/settings
```

### Update Max Weight

```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"max_weight": 600.00}'
```

### Get Device Status

```bash
curl http://localhost:3000/api/status?device_id=esp32_001
```

### Get Weight Logs

```bash
curl http://localhost:3000/api/logs?device_id=esp32_001&limit=10
```

---

## Testing MQTT

### Subscribe ke topics (menggunakan mosquitto-clients)

```bash
# Install mosquitto-clients
# Windows: choco install mosquitto
# Linux: sudo apt-get install mosquitto-clients

# Subscribe ke control topic
mosquitto_sub -h localhost -p 1883 -t device/control

# Subscribe ke settings topic
mosquitto_sub -h localhost -p 1883 -t device/settings
```

### Publish weight data (simulasi device)

```bash
mosquitto_pub -h localhost -p 1883 -t device/weight/data \
  -m '{"device_id":"esp32_001","weight":550.00,"timestamp":"2024-01-15T10:30:00Z"}'
```

---

## Notes

1. **Real-time Updates**: Semua komunikasi menggunakan MQTT untuk real-time updates
2. **Logic di API**: Semua business logic (overload detection, motor/alarm control) ada di API
3. **Database**: Semua data disimpan di Supabase untuk akses dari mobile app
4. **Device ID**: Gunakan device_id yang unik untuk setiap device
5. **Calibration**: Pastikan weight sensor dikalibrasi dengan benar di device
