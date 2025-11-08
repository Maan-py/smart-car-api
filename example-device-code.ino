/*
 * Example ESP32/ESP8266 Code untuk Smart Car IoT
 * 
 * Hardware:
 * - Load Cell + HX711 (Weight Sensor)
 * - Motor DC Driver
 * - Buzzer (Alarm)
 * - WiFi Module
 * 
 * Libraries Required:
 * - WiFi.h (built-in)
 * - PubSubClient.h (MQTT)
 * - HX711.h (Weight sensor)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <HX711.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Configuration - HiveMQ Cloud
const char* mqtt_server = "3577e8e742b544419045e2a77c8ec76d.s1.eu.hivemq.cloud";
const int mqtt_port = 8883; // TLS port
const char* mqtt_username = "YOUR_HIVEMQ_USERNAME";
const char* mqtt_password = "YOUR_HIVEMQ_PASSWORD";
const char* mqtt_client_id = "esp32_car_001";
const char* device_id = "esp32_001";

// MQTT Topics
const char* topic_weight_data = "device/weight/data";
const char* topic_control = "device/control";
const char* topic_settings = "device/settings";
const char* topic_status = "device/status";

// Pin Configuration
#define HX711_DOUT 4
#define HX711_SCK 5
#define MOTOR_PIN 2
#define ALARM_PIN 3

// HX711 Setup
HX711 scale;

// WiFi & MQTT Clients
WiFiClient espClient;
PubSubClient client(espClient);

// Variables
float currentWeight = 0;
float maxWeight = 500.0;
bool motorEnabled = false;
bool alarmEnabled = false;
bool isOverload = false;
unsigned long lastWeightSend = 0;
const unsigned long weightSendInterval = 1000; // Send weight every 1 second

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(ALARM_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW);
  digitalWrite(ALARM_PIN, LOW);
  
  // Initialize HX711
  scale.begin(HX711_DOUT, HX711_SCK);
  scale.set_scale(); // Calibrate this value
  scale.tare(); // Reset scale to 0
  
  // Connect WiFi
  setup_wifi();
  
  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqtt_callback);
}

void loop() {
  // Reconnect if MQTT disconnected
  if (!client.connected()) {
    reconnect_mqtt();
  }
  client.loop();
  
  // Read weight sensor
  if (scale.is_ready()) {
    currentWeight = scale.get_units(10); // Read average of 10 samples
    
    // Send weight data to API every interval
    if (millis() - lastWeightSend >= weightSendInterval) {
      sendWeightData();
      lastWeightSend = millis();
    }
  }
  
  // Control motor and alarm based on received commands
  digitalWrite(MOTOR_PIN, motorEnabled ? HIGH : LOW);
  digitalWrite(ALARM_PIN, alarmEnabled ? HIGH : LOW);
  
  delay(100);
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect_mqtt() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    // Connect with username and password for HiveMQ Cloud
    if (client.connect(mqtt_client_id, mqtt_username, mqtt_password)) {
      Serial.println("connected");
      
      // Subscribe to control and settings topics
      client.subscribe(topic_control);
      client.subscribe(topic_settings);
      
      // Send initial status
      sendStatus();
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  Serial.println(message);
  
  // Parse JSON (simplified - use ArduinoJson library for better parsing)
  if (String(topic) == topic_control) {
    // Parse control command
    // Example: {"motor_enabled":true,"alarm_enabled":false,"is_overload":false}
    if (message.indexOf("\"motor_enabled\":true") > 0) {
      motorEnabled = true;
    } else if (message.indexOf("\"motor_enabled\":false") > 0) {
      motorEnabled = false;
    }
    
    if (message.indexOf("\"alarm_enabled\":true") > 0) {
      alarmEnabled = true;
    } else if (message.indexOf("\"alarm_enabled\":false") > 0) {
      alarmEnabled = false;
    }
    
    if (message.indexOf("\"is_overload\":true") > 0) {
      isOverload = true;
    } else if (message.indexOf("\"is_overload\":false") > 0) {
      isOverload = false;
    }
    
    // Extract max_weight if present
    int maxWeightIndex = message.indexOf("\"max_weight\":");
    if (maxWeightIndex > 0) {
      String maxWeightStr = message.substring(maxWeightIndex + 12);
      maxWeightStr = maxWeightStr.substring(0, maxWeightStr.indexOf(","));
      maxWeight = maxWeightStr.toFloat();
    }
  }
  
  if (String(topic) == topic_settings) {
    // Parse settings update
    int maxWeightIndex = message.indexOf("\"max_weight\":");
    if (maxWeightIndex > 0) {
      String maxWeightStr = message.substring(maxWeightIndex + 12);
      maxWeightStr = maxWeightStr.substring(0, maxWeightStr.indexOf("}"));
      maxWeight = maxWeightStr.toFloat();
      Serial.print("Max weight updated to: ");
      Serial.println(maxWeight);
    }
  }
}

void sendWeightData() {
  String payload = "{";
  payload += "\"device_id\":\"" + String(device_id) + "\",";
  payload += "\"weight\":" + String(currentWeight, 2) + ",";
  payload += "\"timestamp\":\"" + getTimestamp() + "\"";
  payload += "}";
  
  client.publish(topic_weight_data, payload.c_str());
  Serial.println("Weight sent: " + String(currentWeight, 2) + " kg");
}

void sendStatus() {
  String payload = "{";
  payload += "\"device_id\":\"" + String(device_id) + "\",";
  payload += "\"status\":\"online\",";
  payload += "\"timestamp\":\"" + getTimestamp() + "\"";
  payload += "}";
  
  client.publish(topic_status, payload.c_str());
}

String getTimestamp() {
  // Simplified timestamp - use NTP for real timestamp
  return String(millis());
}

