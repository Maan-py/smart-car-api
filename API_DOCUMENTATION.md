# API Documentation - Smart Car IoT

## Base URL

```
http://localhost:3000/api
```

## Authentication

Saat ini API tidak menggunakan authentication. Untuk production, disarankan menambahkan JWT atau API key authentication.

---

## Endpoints Overview

| Area      | Method | Endpoint                | Fungsi                                          |
| --------- | ------ | ----------------------- | ----------------------------------------------- |
| Device    | POST   | /api/devices/register   | Registrasi ESP32                                |
| Device    | GET    | /api/devices/:id/status | Status & last telemetry                         |
| Settings  | GET    | /api/settings           | Ambil max_weight                                |
| Settings  | POST   | /api/settings           | Ubah max_weight (push MQTT, optional device_id) |
| Telemetry | GET    | /api/telemetry          | Riwayat berat                                   |
| Events    | GET    | /api/events             | Log overload & recovery                         |
| Control   | POST   | /api/control            | Kirim command via MQTT (motor, alarm, movement) |
| Control   | GET    | /api/control-log        | Riwayat command                                 |

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
  "service": "Smart Car IoT API",
  "mqtt_connected": true
}
```

---

### 2. Device Registration

**POST** `/api/devices/register`

Registrasi ESP32 device. Jika device sudah terdaftar, akan diupdate dengan data baru.

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

**Request Body Fields:**

- `device_id` (required) - Unique device identifier
- `device_name` (optional) - Nama device
- `device_type` (optional) - Tipe device, default: "ESP32"
- `mac_address` (optional) - MAC address device
- `firmware_version` (optional) - Versi firmware device

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

**Catatan:**

- Jika device belum pernah mengirim data, `current_weight` akan 0 dan `last_telemetry` akan `null`
- `last_update` akan `null` jika device belum pernah mengirim data

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

Mengupdate pengaturan berat maksimal. Update ini akan langsung dikirim ke device via MQTT. Jika `device_id` tidak disediakan, akan mengupdate setting global.

**Request Body:**

```json
{
  "max_weight": 600.0,
  "device_id": "esp32_001"
}
```

**Request Body Fields:**

- `max_weight` (required) - Berat maksimal dalam kilogram
- `device_id` (optional) - Device ID untuk update per-device. Jika tidak disediakan, akan update global setting.

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "max_weight": 600.0,
    "device_id": "esp32_001"
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

**Catatan:**

- Device harus sudah terdaftar sebelumnya jika menggunakan `device_id`
- Setting untuk device atau global harus sudah ada sebelumnya (tidak bisa create baru via API)

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

Mengirim command ke device via MQTT. Command dapat berupa kontrol motor, alarm, kontrol pergerakan (maju/mundur), atau command lainnya.

**Request Body (Contoh 1 - Kontrol Motor & Alarm):**

```json
{
  "device_id": "esp32_001",
  "motor_enabled": false,
  "alarm_enabled": true
}
```

**Request Body (Contoh 2 - Kontrol Pergerakan/Maju):**

```json
{
  "device_id": "esp32_001",
  "direction": "forward",
  "speed": 100
}
```

**Request Body (Contoh 3 - Kontrol Pergerakan/Mundur):**

```json
{
  "device_id": "esp32_001",
  "direction": "reverse",
  "speed": 80
}
```

**Request Body (Contoh 4 - Stop):**

```json
{
  "device_id": "esp32_001",
  "direction": "stop"
}
```

**Fields:**

- `device_id` (required) - Device ID target
- `motor_enabled` (optional) - Boolean untuk enable/disable motor
- `alarm_enabled` (optional) - Boolean untuk enable/disable alarm
- `direction` (optional) - Arah pergerakan: `"forward"` (maju), `"reverse"` (mundur), atau `"stop"` (berhenti)
- `speed` (optional) - Kecepatan (0-100 atau sesuai implementasi device)
- Fields lainnya dapat ditambahkan sesuai kebutuhan

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "command": {
      "device_id": "esp32_001",
      "direction": "forward",
      "speed": 100,
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

**Command Types (auto-determined):**

- `movement_control` - Jika `direction` disediakan (forward, reverse, stop)
- `motor_control` - Jika `motor_enabled` dan `alarm_enabled` keduanya disediakan
- `alarm_control` - Jika hanya `alarm_enabled` yang disediakan
- `manual_control` - Untuk command lainnya

**Catatan Penting:**

- Command `direction` (forward/reverse/stop) dari mobile app akan dikirim langsung ke device via MQTT
- Semua command akan di-log ke database (`control_logs`) dengan command type yang sesuai
- Device ESP32 harus subscribe ke topic `device/control` untuk menerima command
- Jika device dalam kondisi overload (berat melebihi max_weight), sistem akan otomatis mengirim command untuk mematikan motor, namun command manual dari mobile app tetap dapat dikirim (device dapat memutuskan prioritasnya)
- Untuk keamanan, disarankan device memprioritaskan kondisi overload daripada command manual

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

- `movement_control` - Control pergerakan (forward, reverse, stop) dari mobile app
- `motor_control` - Control motor dan alarm (otomatis dari sistem atau manual)
- `alarm_control` - Control alarm saja
- `settings_update` - Update settings
- `manual_control` - Manual control lainnya dari mobile app

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

API mengirim perintah kontrol ke device. Dapat berupa kontrol dari sistem (berdasarkan berat) atau dari mobile app (remote control).

**Payload Format (Contoh 1 - Kontrol Otomatis dari Sistem):**

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

**Payload Format (Contoh 2 - Kontrol Pergerakan dari Mobile App):**

```json
{
  "device_id": "esp32_001",
  "direction": "forward",
  "speed": 100,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Payload Format (Contoh 3 - Stop dari Mobile App):**

```json
{
  "device_id": "esp32_001",
  "direction": "stop",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Fields:**

- `device_id` (string) - Device ID target
- `motor_enabled` (boolean, optional) - `true` jika motor boleh berjalan, `false` jika harus mati
- `alarm_enabled` (boolean, optional) - `true` jika alarm harus berbunyi, `false` jika mati
- `direction` (string, optional) - Arah pergerakan: `"forward"` (maju), `"reverse"` (mundur), atau `"stop"` (berhenti)
- `speed` (number, optional) - Kecepatan (0-100 atau sesuai implementasi device)
- `is_overload` (boolean, optional) - `true` jika berat melebihi maksimal
- `max_weight` (number, optional) - Berat maksimal saat ini
- `current_weight` (number, optional) - Berat saat ini
- `timestamp` (string) - ISO timestamp

**Logic (Kontrol Otomatis dari Sistem):**

- Jika `is_overload = true`:
  - `motor_enabled = false` (mobil tidak boleh berjalan)
  - `alarm_enabled = true` (alarm berbunyi)
- Jika `is_overload = false`:
  - `motor_enabled = true` (mobil boleh berjalan)
  - `alarm_enabled = false` (alarm mati)

**Logic (Kontrol Manual dari Mobile App):**

- `direction = "forward"` - Mobil bergerak maju dengan kecepatan sesuai `speed`
- `direction = "reverse"` - Mobil bergerak mundur dengan kecepatan sesuai `speed`
- `direction = "stop"` - Mobil berhenti (speed akan diabaikan)

---

#### `device/settings`

API mengirim update pengaturan ketika max_weight diubah dari mobile app.

**Payload Format:**

```json
{
  "max_weight": 600.0,
  "device_id": "esp32_001",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Fields:**

- `max_weight` (number) - Berat maksimal baru
- `device_id` (string) - Device ID target, atau "all" untuk broadcast ke semua device
- `timestamp` (string) - ISO timestamp

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
Check if state changed (overload → recovery or vice versa)
    ↓
    └─ YES → Log event (overload or recovery) to events table
    ↓
Publish to MQTT: device/control
    ↓
Log control command to control_logs table
    ↓
Device receives & executes
    ↓
Motor & Alarm controlled
```

**Event Logging:**

- Event `overload` dicatat ketika berat melebihi `max_weight` untuk pertama kali
- Event `recovery` dicatat ketika berat kembali di bawah `max_weight`
- Event hanya dicatat saat terjadi perubahan state (transisi), bukan untuk setiap pembacaan berat

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
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"max_weight": 600.00}'
```

### Update Max Weight for Specific Device

```bash
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"max_weight": 600.00, "device_id": "esp32_001"}'
```

### Get Device Status

```bash
curl http://localhost:3000/api/devices/esp32_001/status
```

### Register Device

```bash
curl -X POST http://localhost:3000/api/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32_001",
    "device_name": "Car 1",
    "device_type": "ESP32",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "firmware_version": "1.0.0"
  }'
```

### Get Weight Logs (Telemetry)

```bash
curl http://localhost:3000/api/telemetry?device_id=esp32_001&limit=10
```

### Get Events

```bash
curl http://localhost:3000/api/events?device_id=esp32_001&limit=10
```

### Send Control Command (Motor & Alarm)

```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32_001",
    "motor_enabled": false,
    "alarm_enabled": true
  }'
```

### Send Control Command (Maju)

```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32_001",
    "direction": "forward",
    "speed": 100
  }'
```

### Send Control Command (Mundur)

```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32_001",
    "direction": "reverse",
    "speed": 80
  }'
```

### Send Control Command (Stop)

```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32_001",
    "direction": "stop"
  }'
```

### Get Control Logs

```bash
curl http://localhost:3000/api/control-log?device_id=esp32_001&limit=10
```

---

## Testing MQTT

**Catatan:** API ini menggunakan HiveMQ Cloud dengan TLS/SSL. Untuk testing, Anda perlu mengkonfigurasi koneksi MQTT yang sesuai di file `.env`.

### Subscribe ke topics (menggunakan mosquitto-clients)

```bash
# Install mosquitto-clients
# Windows: choco install mosquitto
# Linux: sudo apt-get install mosquitto-clients
# macOS: brew install mosquitto

# Subscribe ke control topic (gunakan credentials dari .env)
mosquitto_sub -h <HIVEMQ_URL> -p <HIVEMQ_PORT> \
  -u <HIVEMQ_USERNAME> -P <HIVEMQ_PASSWORD> \
  --cafile <path-to-ca-cert> \
  -t device/control

# Subscribe ke settings topic
mosquitto_sub -h <HIVEMQ_URL> -p <HIVEMQ_PORT> \
  -u <HIVEMQ_USERNAME> -P <HIVEMQ_PASSWORD> \
  --cafile <path-to-ca-cert> \
  -t device/settings

# Subscribe ke weight data topic (untuk monitoring)
mosquitto_sub -h <HIVEMQ_URL> -p <HIVEMQ_PORT> \
  -u <HIVEMQ_USERNAME> -P <HIVEMQ_PASSWORD> \
  --cafile <path-to-ca-cert> \
  -t device/weight/data
```

### Publish weight data (simulasi device)

```bash
mosquitto_pub -h <HIVEMQ_URL> -p <HIVEMQ_PORT> \
  -u <HIVEMQ_USERNAME> -P <HIVEMQ_PASSWORD> \
  --cafile <path-to-ca-cert> \
  -t device/weight/data \
  -m '{"device_id":"esp32_001","weight":550.00,"timestamp":"2024-01-15T10:30:00Z"}'
```

**MQTT Topics:**

- `device/weight/data` - Device → API (weight data)
- `device/control` - API → Device (control commands)
- `device/status` - Device → API (status updates, optional)
- `device/settings` - API → Device (settings updates)

---

## Database Schema

API menggunakan tabel-tabel berikut di Supabase:

- **devices** - Daftar perangkat yang terdaftar
- **settings** - Pengaturan max_weight (global atau per-device)
- **weight_logs** - Riwayat data berat dari sensor
- **device_status** - Status real-time setiap device
- **events** - Log events (overload, recovery)
- **control_logs** - Riwayat command yang dikirim ke device

## Notes

1. **Real-time Updates**: Semua komunikasi menggunakan MQTT (HiveMQ Cloud) untuk real-time updates dengan TLS/SSL
2. **Logic di API**: Semua business logic (overload detection, motor/alarm control) ada di API
3. **Database**: Semua data disimpan di Supabase untuk akses dari mobile app
4. **Device ID**: Gunakan device_id yang unik untuk setiap device
5. **Calibration**: Pastikan weight sensor dikalibrasi dengan benar di device
6. **Settings**: Device harus sudah terdaftar dan setting harus sudah ada sebelum dapat diupdate
7. **Health Check**: Endpoint `/health` menampilkan status MQTT connection untuk monitoring
8. **Error Handling**: Semua error mengembalikan format response yang konsisten dengan `success: false` dan pesan error
9. **Pagination**: Endpoint yang mengembalikan list data (telemetry, events, control-log) mendukung pagination dengan `limit` dan `offset`
10. **Remote Control**: Mobile app dapat mengirim command maju (`forward`), mundur (`reverse`), dan stop (`stop`) melalui endpoint `/api/control` dengan field `direction` dan `speed`
11. **Command Priority**: Disarankan device ESP32 memprioritaskan kondisi overload (dari sistem) daripada command manual dari mobile app untuk keamanan
12. **Command Logging**: Semua command yang dikirim akan di-log ke database untuk audit trail
