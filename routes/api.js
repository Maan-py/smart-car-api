import express from "express";
import { getMaxWeight, updateMaxWeight, getDeviceStatusWithTelemetry, getWeightLogs, registerDevice, getEvents, sendControlCommand, getControlLogs } from "../services/weightService.js";

const router = express.Router();

// ============================================
// DEVICE ENDPOINTS
// ============================================

/**
 * POST /api/devices/register
 * Registrasi ESP32
 * Body: { device_id, name?, location? }
 */
router.post("/devices/register", async (req, res) => {
  try {
    const { device_id, name, location } = req.body;

    if (!device_id) {
      return res.status(400).json({
        success: false,
        error: "device_id is required",
      });
    }

    const device = await registerDevice({ device_id, name, location });

    res.json({
      success: true,
      data: device,
    });
  } catch (error) {
    console.error("Error in POST /api/devices/register:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/devices/:id/status
 * Status & last telemetry
 */
router.get("/devices/:id/status", async (req, res) => {
  try {
    const deviceId = req.params.id;
    const status = await getDeviceStatusWithTelemetry(deviceId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error in GET /api/devices/:id/status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// SETTINGS ENDPOINTS
// ============================================

/**
 * GET /api/settings
 * Ambil max_weight
 */
router.get("/settings", async (req, res) => {
  try {
    const deviceId = req.query.device_id || null;
    const maxWeight = await getMaxWeight(deviceId);
    res.json({
      success: true,
      data: {
        max_weight: maxWeight,
        ...(deviceId ? { device_id: deviceId } : { scope: "global" }),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/settings:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/settings
 * Ubah max_weight (push MQTT)
 * Body: { max_weight: number, device_id?: string }
 * Jika device_id tidak ada, akan update global setting
 */
router.post("/settings", async (req, res) => {
  try {
    const { max_weight, device_id } = req.body;

    if (!max_weight || isNaN(max_weight) || max_weight <= 0) {
      return res.status(400).json({
        success: false,
        error: "max_weight harus berupa angka positif",
      });
    }

    // updatedBy can be from header or default to 'mobile_app'
    const updatedBy = req.headers["user-agent"] || "mobile_app";

    // Call with correct parameters: (maxWeight, deviceId, updatedBy)
    const result = await updateMaxWeight(
      max_weight,
      device_id || null, // device_id is optional, null means global
      updatedBy
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in POST /api/settings:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// TELEMETRY ENDPOINTS
// ============================================

/**
 * GET /api/telemetry
 * Riwayat berat
 * Query: ?device_id=xxx&limit=100&offset=0
 */
router.get("/telemetry", async (req, res) => {
  try {
    const deviceId = req.query.device_id || null;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const logs = await getWeightLogs(deviceId, limit, offset);

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit,
        offset,
        count: logs.length,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/telemetry:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// EVENTS ENDPOINTS
// ============================================

/**
 * GET /api/events
 * Log overload & recovery
 * Query: ?device_id=xxx&limit=100&offset=0
 */
router.get("/events", async (req, res) => {
  try {
    const deviceId = req.query.device_id || null;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const events = await getEvents(deviceId, limit, offset);

    res.json({
      success: true,
      data: events,
      pagination: {
        limit,
        offset,
        count: events.length,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/events:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// CONTROL ENDPOINTS
// ============================================

/**
 * POST /api/control
 * Kirim command via MQTT
 * Body: { device_id, motor_enabled?, alarm_enabled?, ... }
 */
router.post("/control", async (req, res) => {
  try {
    const { device_id, ...commandData } = req.body;

    if (!device_id) {
      return res.status(400).json({
        success: false,
        error: "device_id is required",
      });
    }

    const result = await sendControlCommand(device_id, commandData, "mobile_app");

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in POST /api/control:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/control-log
 * Riwayat command
 * Query: ?device_id=xxx&limit=100&offset=0
 */
router.get("/control-log", async (req, res) => {
  try {
    const deviceId = req.query.device_id || null;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const logs = await getControlLogs(deviceId, limit, offset);

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit,
        offset,
        count: logs.length,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/control-log:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
