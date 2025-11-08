import mqtt from "mqtt";
import dotenv from "dotenv";

dotenv.config();

// MQTT Topics
export const MQTT_TOPICS = {
  WEIGHT_DATA: "device/weight/data", // Device → API (weight data)
  CONTROL: "device/control", // API → Device (commands)
  STATUS: "device/status", // Device → API (status updates)
  SETTINGS: "device/settings", // API → Device (settings updates)
};

// HiveMQ Cloud Configuration
const HIVEMQ_URL = process.env.HIVEMQ_URL;
const HIVEMQ_PORT = process.env.HIVEMQ_PORT;
const HIVEMQ_USERNAME = process.env.HIVEMQ_USERNAME;
const HIVEMQ_PASSWORD = process.env.HIVEMQ_PASSWORD;
const HIVEMQ_CLIENT_ID = process.env.HIVEMQ_CLIENT_ID || `smart-car-api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Create MQTT Client
let mqttClient = null;
let isSubscribed = false;

/**
 * Connect to HiveMQ Cloud
 */
export function connectMQTT() {
  if (mqttClient && mqttClient.connected) {
    console.log("[MQTT] Already connected to HiveMQ");
    return mqttClient;
  }

  if (!HIVEMQ_URL || !HIVEMQ_PORT || !HIVEMQ_USERNAME || !HIVEMQ_PASSWORD) {
    console.error("[MQTT] Missing HiveMQ configuration. Please check your .env file.");
    return null;
  }

  // MQTT Client Options
  const mqttOptions = {
    host: HIVEMQ_URL,
    port: parseInt(HIVEMQ_PORT),
    protocol: "mqtts", // TLS/SSL
    username: HIVEMQ_USERNAME,
    password: HIVEMQ_PASSWORD,
    clientId: HIVEMQ_CLIENT_ID,
    clean: true,
    reconnectPeriod: 5000, // Increase reconnect period to 5 seconds
    connectTimeout: 30 * 1000,
    rejectUnauthorized: true, // Verify SSL certificate
    keepalive: 60, // Keep alive interval
  };

  const brokerUrl = `mqtts://${HIVEMQ_URL}:${HIVEMQ_PORT}`;
  console.log(`[MQTT] Connecting to HiveMQ Cloud: ${brokerUrl}`);
  console.log(`[MQTT] Client ID: ${HIVEMQ_CLIENT_ID}`);

  mqttClient = mqtt.connect(brokerUrl, mqttOptions);

  // Connection event handlers
  mqttClient.on("connect", () => {
    console.log(`[MQTT] Connected to HiveMQ Cloud successfully`);
    isSubscribed = false;

    // Subscribe to topics after a short delay to ensure connection is fully established
    setTimeout(() => {
      subscribeToTopics();
    }, 500);
  });

  mqttClient.on("error", (error) => {
    console.error("[MQTT] Connection error:", error.message);
  });

  mqttClient.on("close", () => {
    console.log("[MQTT] Connection closed");
    isSubscribed = false;
  });

  mqttClient.on("reconnect", () => {
    console.log("[MQTT] Reconnecting to HiveMQ...");
    isSubscribed = false;
  });

  mqttClient.on("offline", () => {
    console.log("[MQTT] Client is offline");
    isSubscribed = false;
  });

  mqttClient.on("disconnect", () => {
    console.log("[MQTT] Disconnected from HiveMQ");
    isSubscribed = false;
  });

  return mqttClient;
}

/**
 * Subscribe to MQTT topics
 */
function subscribeToTopics() {
  if (!mqttClient) {
    console.warn("[MQTT] Cannot subscribe - client not initialized");
    return;
  }

  if (!mqttClient.connected) {
    console.warn("[MQTT] Cannot subscribe - client not connected");
    return;
  }

  if (isSubscribed) {
    console.log("[MQTT] Already subscribed to topics");
    return;
  }

  const topics = [MQTT_TOPICS.WEIGHT_DATA, MQTT_TOPICS.STATUS];

  topics.forEach((topic) => {
    mqttClient.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] Failed to subscribe to ${topic}:`, err);
        isSubscribed = false;
      } else {
        console.log(`[MQTT] Subscribed to topic: ${topic}`);
      }
    });
  });

  // Mark as subscribed after all subscriptions
  isSubscribed = true;
}

/**
 * Publish message to MQTT topic
 */
export function publishMQTT(topic, message, options = {}) {
  if (!mqttClient || !mqttClient.connected) {
    console.error("[MQTT] Cannot publish - client not connected");
    return false;
  }

  const payload = typeof message === "string" ? message : JSON.stringify(message);
  const publishOptions = {
    qos: 1,
    retain: false,
    ...options,
  };

  mqttClient.publish(topic, payload, publishOptions, (err) => {
    if (err) {
      console.error(`[MQTT] Failed to publish to ${topic}:`, err);
    } else {
      console.log(`[MQTT] Published to ${topic}:`, message);
    }
  });

  return true;
}

/**
 * Get MQTT client instance
 */
export function getMQTTClient() {
  return mqttClient;
}

/**
 * Check if MQTT client is connected
 */
export function isMQTTConnected() {
  return mqttClient && mqttClient.connected;
}

// Don't auto-connect - let server.js handle the connection
// connectMQTT();

// Export for backward compatibility (used in weightService.js)
export const broker = {
  publish: (packet) => {
    publishMQTT(packet.topic, packet.payload.toString(), { qos: packet.qos || 1 });
  },
  on: (event, callback) => {
    if (event === "publish") {
      // Handle publish events from devices
      mqttClient?.on("message", (topic, message) => {
        const packet = {
          topic: topic,
          payload: Buffer.from(message),
        };
        callback(packet, { id: "device" });
      });
    }
  },
};
