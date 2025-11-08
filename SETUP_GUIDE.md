# Setup Guide - Smart Car IoT API

## Langkah-langkah Setup

### 1. Install Node.js

Pastikan Node.js versi 16+ sudah terinstall:

```bash
node --version
```

### 2. Install Dependencies

```bash
cd api
npm install
```

### 3. Setup Supabase

#### a. Buat Project di Supabase

1. Buka [https://supabase.com](https://supabase.com)
2. Buat account baru atau login
3. Klik "New Project"
4. Isi nama project dan password database
5. Tunggu hingga project selesai dibuat

#### b. Jalankan SQL Schema

1. Di Supabase dashboard, buka **SQL Editor**
2. Copy semua isi file `api/supabase/schema.sql`
3. Paste ke SQL Editor
4. Klik **Run** untuk menjalankan

#### c. Ambil API Keys

1. Di Supabase dashboard, buka **Settings** → **API**
2. Copy **Project URL** → ini adalah `SUPABASE_URL`
3. Copy **anon public** key → ini adalah `SUPABASE_KEY`
4. Copy **service_role** key → ini adalah `SUPABASE_SERVICE_KEY` (untuk admin operations)

### 4. Setup Environment Variables

Buat file `.env` di folder `api/`:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

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

**Penting:** Jangan commit file `.env` ke git!

### 5. Test Database Connection

Jalankan server:

```bash
npm start
```

Jika tidak ada error, berarti koneksi database berhasil.

### 6. Test API Endpoints

#### Test Health Check

```bash
curl http://localhost:3000/health
```

#### Test Get Settings

```bash
curl http://localhost:3000/api/settings
```

#### Test Update Settings

```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d "{\"max_weight\": 600.00}"
```

### 7. Test MQTT Broker

#### Install MQTT Client (mosquitto)

**Windows:**

```bash
choco install mosquitto
```

**Linux:**

```bash
sudo apt-get install mosquitto-clients
```

**Mac:**

```bash
brew install mosquitto
```

#### Subscribe ke Control Topic

```bash
mosquitto_sub -h localhost -p 1883 -t device/control
```

#### Simulasi Device (Publish Weight Data)

Buka terminal baru:

```bash
mosquitto_pub -h localhost -p 1883 -t device/weight/data \
  -m '{"device_id":"test_device","weight":550.00,"timestamp":"2024-01-15T10:30:00Z"}'
```

Anda seharusnya melihat message di terminal yang subscribe ke `device/control` dengan perintah untuk mematikan motor dan menyalakan alarm (karena 550 > 500).

### 8. Verifikasi Database

Di Supabase dashboard:

1. Buka **Table Editor**
2. Cek tabel `settings` - harus ada 1 row dengan max_weight = 500
3. Cek tabel `weight_logs` - harus ada log dari test di atas
4. Cek tabel `device_status` - harus ada status device

## Troubleshooting

### Error: Missing Supabase configuration

- Pastikan file `.env` sudah dibuat
- Pastikan `SUPABASE_URL` dan `SUPABASE_KEY` sudah diisi

### Error: Connection to Supabase failed

- Cek apakah URL dan key sudah benar
- Cek koneksi internet
- Pastikan project Supabase masih aktif

### MQTT tidak menerima message

- Pastikan MQTT broker sudah running (cek console saat start server)
- Pastikan port 1883 tidak digunakan aplikasi lain
- Cek firewall settings

### Database table tidak ada

- Pastikan SQL schema sudah dijalankan di Supabase SQL Editor
- Cek apakah ada error saat menjalankan SQL

## Next Steps

1. **Setup Device (ESP32/ESP8266)**

   - Lihat file `example-device-code.ino` untuk contoh code
   - Update WiFi credentials
   - Update MQTT server IP (IP address komputer yang menjalankan API)
   - Upload code ke device

2. **Develop Mobile App**

   - Gunakan REST API endpoints untuk:
     - Get/Set max weight: `GET/PUT /api/settings`
     - Monitor status: `GET /api/status`
     - View logs: `GET /api/logs`

3. **Deploy ke Production**
   - Deploy API ke cloud (Heroku, Railway, atau VPS)
   - Update MQTT server IP di device
   - Setup domain untuk API

## Tips

- Gunakan `npm run dev` untuk development (auto-reload)
- Monitor logs di console untuk debugging
- Gunakan Supabase dashboard untuk melihat data real-time
- Test MQTT dengan mosquitto-clients sebelum connect device
