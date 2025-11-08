# HiveMQ Cloud Setup Guide

## Konfigurasi HiveMQ Cloud

API sudah dikonfigurasi untuk menggunakan HiveMQ Cloud sebagai MQTT broker.

### 1. HiveMQ Cloud Details

- **URL**: `3577e8e742b544419045e2a77c8ec76d.s1.eu.hivemq.cloud`
- **TLS MQTT Port**: `8883`
- **TLS WebSocket Port**: `8884`

### 2. Setup Environment Variables

Tambahkan ke file `.env`:

```env
# HiveMQ Cloud Configuration
HIVEMQ_URL=3577e8e742b544419045e2a77c8ec76d.s1.eu.hivemq.cloud
HIVEMQ_PORT=8883
HIVEMQ_USERNAME=your_hivemq_username
HIVEMQ_PASSWORD=your_hivemq_password
HIVEMQ_CLIENT_ID=smart-car-api
```

### 3. Mendapatkan HiveMQ Credentials

1. Login ke [HiveMQ Cloud Console](https://console.hivemq.cloud/)
2. Pilih cluster Anda
3. Buka **Access Management** → **Credentials**
4. Buat credentials baru atau gunakan yang sudah ada
5. Copy **Username** dan **Password**

### 4. Testing Connection

Setelah setup, jalankan server:

```bash
cd api
npm start
```

Anda akan melihat log:
```
[MQTT] Connecting to HiveMQ Cloud: mqtts://3577e8e742b544419045e2a77c8ec76d.s1.eu.hivemq.cloud:8883
[MQTT] Connected to HiveMQ Cloud successfully
[MQTT] Subscribed to topic: device/weight/data
[MQTT] Subscribed to topic: device/status
```

### 5. Device Configuration (ESP32)

Untuk ESP32, update kode dengan:

```cpp
// MQTT Configuration - HiveMQ Cloud
const char* mqtt_server = "3577e8e742b544419045e2a77c8ec76d.s1.eu.hivemq.cloud";
const int mqtt_port = 8883; // TLS port
const char* mqtt_username = "YOUR_HIVEMQ_USERNAME";
const char* mqtt_password = "YOUR_HIVEMQ_PASSWORD";
```

**Penting untuk ESP32:**
- Gunakan `WiFiClientSecure` untuk TLS connection
- Install root CA certificate untuk HiveMQ
- Library yang diperlukan: `PubSubClient` dan `WiFiClientSecure`

### 6. WebSocket Connection

Untuk WebSocket connection (misalnya dari web browser):

```
wss://3577e8e742b544419045e2a77c8ec76d.s1.eu.hivemq.cloud:8884/mqtt
```

### 7. Topics

API akan subscribe ke:
- `device/weight/data` - Menerima data berat dari device
- `device/status` - Menerima status update dari device

API akan publish ke:
- `device/control` - Mengirim command ke device
- `device/settings` - Mengirim update settings ke device

### 8. Troubleshooting

**Connection Error:**
- Pastikan username dan password benar
- Pastikan port 8883 tidak diblokir firewall
- Cek apakah HiveMQ cluster masih aktif

**SSL/TLS Error:**
- Pastikan menggunakan `mqtts://` protocol
- Untuk ESP32, pastikan root CA certificate sudah diinstall

**Authentication Failed:**
- Double-check username dan password
- Pastikan credentials masih aktif di HiveMQ console

### 9. Monitoring

Anda bisa monitor connection di HiveMQ Cloud Console:
- **Connections** - Lihat connected clients
- **Messages** - Monitor message flow
- **Topics** - Lihat subscribed topics

