import { supabase } from "../config/supabase.js";
import { publishMQTT, MQTT_TOPICS } from "../config/mqtt.js";

/**
 * Get max weight setting (global or per-device)
 */
export async function getMaxWeight(deviceId = null) {
  try {
    let query = supabase.from("settings").select("max_weight, updated_at").order("updated_at", { ascending: false });

    // If device_id provided, get device-specific setting first, else get global
    if (deviceId) {
      query = query.eq("device_id", deviceId);
    } else {
      query = query.is("device_id", null);
    }

    const { data, error } = await query.limit(1).single();

    if (error && error.code === "PGRST116") {
      // Not found, try global if looking for device-specific
      if (deviceId) {
        const { data: globalData } = await supabase.from("settings").select("max_weight").is("device_id", null).order("updated_at", { ascending: false }).limit(1).single();
        return globalData?.max_weight || 500.0;
      }
      return 500.0;
    }

    if (error) throw error;
    return data?.max_weight || 500.0;
  } catch (error) {
    console.error("Error getting max weight:", error);
    throw error;
  }
}

/**
 * Update max weight setting (global or per-device)
 */
export async function updateMaxWeight(newMaxWeight, deviceId = null, updatedBy = "mobile_app") {
  try {
    const { data, error } = await supabase.from("settings").insert({
      device_id: deviceId || null,
      max_weight: parseFloat(newMaxWeight),
      updated_by: updatedBy,
    });

    if (error) throw error;

    // Publish settings update to device(s) via MQTT
    const settingsPayload = {
      max_weight: parseFloat(newMaxWeight),
      device_id: deviceId || "all",
      timestamp: new Date().toISOString(),
    };

    // Log control command for settings update
    await logControlCommand(deviceId || "all", "set_max_weight", settingsPayload, updatedBy);

    publishMQTT(MQTT_TOPICS.SETTINGS, settingsPayload, { qos: 1 });

    return { success: true, max_weight: parseFloat(newMaxWeight), device_id: deviceId };
  } catch (error) {
    console.error("Error updating max weight:", error);
    throw error;
  }
}

/**
 * Process weight data from device
 * This is the main logic: check if overload, control motor and alarm
 */
export async function processWeightData(weightData) {
  try {
    const { weight, device_id, raw_payload } = weightData;
    const currentWeight = parseFloat(weight);
    const deviceId = device_id || "default_device";

    // Get max weight for this device (or global)
    const maxWeight = await getMaxWeight(deviceId);

    // Check if overload
    const isOverload = currentWeight > maxWeight;
    const status = isOverload ? "overload" : "normal";

    // Get last log to detect state changes
    const { data: lastLog } = await supabase.from("log_weight").select("status").eq("device_id", deviceId).order("timestamp", { ascending: false }).limit(1).single();

    const previousStatus = lastLog?.status || "normal";
    const previousOverload = previousStatus === "overload";

    // Log event if state changed (overload or recovery)
    if (previousOverload !== isOverload) {
      const eventType = isOverload ? "overload" : "recovered";
      const details = `Weight changed from ${previousStatus} to ${status}. Current: ${currentWeight}kg, Max: ${maxWeight}kg`;

      const { error: eventError } = await supabase.from("events").insert({
        device_id: deviceId,
        event_type: eventType,
        details: details,
      });

      if (eventError) {
        console.error("Error logging event:", eventError);
      } else {
        console.log(`[Weight Service] Event logged: ${eventType} - ${currentWeight}kg`);
      }
    }

    // Log weight data
    const { error: logError } = await supabase.from("log_weight").insert({
      device_id: deviceId,
      weight: currentWeight,
      status: status,
      raw_payload: raw_payload || null,
    });

    if (logError) {
      console.error("Error logging weight:", logError);
    }

    // Determine motor and alarm state
    const motorEnabled = !isOverload;
    const alarmEnabled = isOverload;

    // Send control commands to device via MQTT
    const controlCommand = {
      device_id: deviceId,
      command: motorEnabled ? "motor_on" : "motor_off",
      motor_enabled: motorEnabled,
      alarm_enabled: alarmEnabled,
      max_weight: maxWeight,
      current_weight: currentWeight,
      is_overload: isOverload,
      timestamp: new Date().toISOString(),
    };

    // Log control command
    await logControlCommand(deviceId, motorEnabled ? "motor_on" : "motor_off", controlCommand, "system");

    publishMQTT(MQTT_TOPICS.CONTROL, controlCommand, { qos: 1 });

    console.log(`[Weight Service] Processed: ${currentWeight}kg / ${maxWeight}kg - Status: ${status}`);

    return {
      success: true,
      current_weight: currentWeight,
      max_weight: maxWeight,
      is_overload: isOverload,
      status: status,
      motor_enabled: motorEnabled,
      alarm_enabled: alarmEnabled,
    };
  } catch (error) {
    console.error("Error processing weight data:", error);
    throw error;
  }
}

/**
 * Get current device status (from last log_weight)
 */
export async function getDeviceStatus(deviceId = "default_device") {
  try {
    // Get last weight log
    const { data: lastLog, error } = await supabase.from("log_weight").select("*").eq("device_id", deviceId).order("timestamp", { ascending: false }).limit(1).single();

    if (error && error.code !== "PGRST116") throw error;

    if (!lastLog) {
      return {
        device_id: deviceId,
        current_weight: 0,
        status: "normal",
        is_overload: false,
        motor_enabled: false,
        alarm_active: false,
        last_update: null,
      };
    }

    const isOverload = lastLog.status === "overload";

    return {
      device_id: deviceId,
      current_weight: lastLog.weight,
      status: lastLog.status,
      is_overload: isOverload,
      motor_enabled: !isOverload,
      alarm_active: isOverload,
      last_update: lastLog.timestamp,
    };
  } catch (error) {
    console.error("Error getting device status:", error);
    throw error;
  }
}

/**
 * Get weight logs with pagination
 */
export async function getWeightLogs(deviceId = null, limit = 100, offset = 0) {
  try {
    let query = supabase
      .from("log_weight")
      .select("*")
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (deviceId) {
      query = query.eq("device_id", deviceId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting weight logs:", error);
    throw error;
  }
}

/**
 * Register a new device
 */
export async function registerDevice(deviceData) {
  try {
    const { device_id, name, location } = deviceData;

    if (!device_id) {
      throw new Error("device_id is required");
    }

    const { data, error } = await supabase
      .from("devices")
      .upsert(
        {
          device_id,
          name: name || null,
          location: location || null,
          last_seen: new Date().toISOString(),
        },
        {
          onConflict: "device_id",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error("Error registering device:", error);
    throw error;
  }
}

/**
 * Get device status with last telemetry
 */
export async function getDeviceStatusWithTelemetry(deviceId) {
  try {
    // Get device status
    const status = await getDeviceStatus(deviceId);

    // Get last telemetry (log_weight)
    const { data: lastTelemetry, error: telemetryError } = await supabase.from("log_weight").select("*").eq("device_id", deviceId).order("timestamp", { ascending: false }).limit(1).single();

    if (telemetryError && telemetryError.code !== "PGRST116") {
      console.error("Error getting last telemetry:", telemetryError);
    }

    return {
      ...status,
      last_telemetry: lastTelemetry || null,
    };
  } catch (error) {
    console.error("Error getting device status with telemetry:", error);
    throw error;
  }
}

/**
 * Get events (overload, recovery, device offline, etc.)
 */
export async function getEvents(deviceId = null, limit = 100, offset = 0) {
  try {
    let query = supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (deviceId) {
      query = query.eq("device_id", deviceId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting events:", error);
    throw error;
  }
}

/**
 * Send control command to device via MQTT
 */
export async function sendControlCommand(deviceId, commandData, sentBy = "mobile_app") {
  try {
    const { command, payload, ...otherData } = commandData;

    if (!command) {
      throw new Error("command is required");
    }

    // Validate command
    const validCommands = ["reset", "motor_on", "motor_off", "set_max_weight", "forward", "reverse", "stop"];
    if (!validCommands.includes(command)) {
      throw new Error(`Invalid command. Must be one of: ${validCommands.join(", ")}`);
    }

    const controlCommand = {
      device_id: deviceId,
      command: command,
      payload: payload || null,
      ...otherData,
      timestamp: new Date().toISOString(),
    };

    // Log control command
    await logControlCommand(deviceId, command, controlCommand, sentBy);

    // Publish to MQTT
    publishMQTT(MQTT_TOPICS.CONTROL, controlCommand, { qos: 1 });

    console.log(`[Control] Command sent to ${deviceId}:`, controlCommand);

    return {
      success: true,
      command: controlCommand,
    };
  } catch (error) {
    console.error("Error sending control command:", error);
    throw error;
  }
}

/**
 * Log control command
 */
async function logControlCommand(deviceId, command, commandData, sentBy) {
  try {
    const { error } = await supabase.from("control_log").insert({
      device_id: deviceId,
      command: command,
      payload: commandData,
      status: "sent",
      sent_by: sentBy,
    });

    if (error) {
      console.error("Error logging control command:", error);
    }
  } catch (error) {
    console.error("Error in logControlCommand:", error);
  }
}

/**
 * Get control logs
 */
export async function getControlLogs(deviceId = null, limit = 100, offset = 0) {
  try {
    let query = supabase
      .from("control_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (deviceId) {
      query = query.eq("device_id", deviceId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting control logs:", error);
    throw error;
  }
}

/**
 * Update control log status (when device acknowledges)
 */
export async function updateControlLogStatus(logId, status, executedAt = null) {
  try {
    const updateData = {
      status: status,
    };

    if (executedAt) {
      updateData.executed_at = executedAt;
    } else if (status === "ack") {
      updateData.executed_at = new Date().toISOString();
    }

    const { data, error } = await supabase.from("control_log").update(updateData).eq("id", logId).select().single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating control log status:", error);
    throw error;
  }
}
