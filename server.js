import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getMQTTClient, connectMQTT, MQTT_TOPICS, isMQTTConnected } from "./config/mqtt.js";
import { processWeightData } from "./services/weightService.js";
import apiRoutes from "./routes/api.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Smart Car IoT API",
    mqtt_connected: isMQTTConnected(),
  });
});

// API Routes
app.use("/api", apiRoutes);

// Setup MQTT Message Handler
const mqttClient = connectMQTT();

if (mqttClient) {
  mqttClient.on("message", async (topic, message) => {
    try {
      const payload = message.toString();
      console.log(`[MQTT] Received message on ${topic}:`, payload);

      // Handle weight data from device
      if (topic === MQTT_TOPICS.WEIGHT_DATA) {
        const weightData = JSON.parse(payload);
        console.log(`[MQTT] Received weight data:`, weightData);

        // Process weight data (check overload, control motor/alarm)
        await processWeightData(weightData);
      }

      // Handle device status updates
      if (topic === MQTT_TOPICS.STATUS) {
        const statusData = JSON.parse(payload);
        console.log(`[MQTT] Received device status:`, statusData);
        // You can add additional status handling here if needed
      }
    } catch (error) {
      console.error("[MQTT] Error processing message:", error);
    }
  });
} else {
  console.error("[Server] Failed to initialize MQTT client. Check your .env configuration.");
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] API server running on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] API base URL: http://localhost:${PORT}/api`);
});
