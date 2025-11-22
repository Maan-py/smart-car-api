import { supabase } from "../config/supabase.js";
import { broker, MQTT_TOPICS } from "../config/mqtt.js";

/**
 * Get current max weight setting
 * Returns global setting (device_id = NULL) if available, otherwise latest setting
 */
export async function getMaxWeight(deviceId = null) {
  try {
    if (deviceId) {
      // Get device-specific setting
      const { data, error } = await supabase.from("settings").select("max_weight, updated_at").eq("device_id", deviceId).order("updated_at", { ascending: false }).limit(1).single();

      if (error && error.code !== "PGRST116") throw error;
      if (data) return data.max_weight;
    }

    // Get global setting (device_id = NULL)
    const { data: globalData, error: globalError } = await supabase.from("settings").select("max_weight, updated_at").is("device_id", null).order("updated_at", { ascending: false }).limit(1).single();

    if (globalError && globalError.code !== "PGRST116") throw globalError;
    if (globalData) return globalData.max_weight;

    // Fallback to default
    return 500.0;
  } catch (error) {
    console.error("Error getting max weight:", error);
    throw error;
  }
}

/**
 * Update max weight setting (global or per-device)
 * Only updates if device_id already exists and setting already exists
 * Returns error if device or setting not found
 */
export async function updateMaxWeight(newMaxWeight, deviceId = null, updatedBy = "mobile_app") {
  try {
    // If device_id is provided, ensure device exists in devices table
    if (deviceId) {
      // Check if device exists
      const { data: existingDevice, error: deviceCheckError } = await supabase.from("devices").select("device_id").eq("device_id", deviceId).single();

      if (deviceCheckError && deviceCheckError.code === "PGRST116") {
        // Device not found - return error
        throw new Error(`Device ${deviceId} not found. Please register the device first.`);
      } else if (deviceCheckError) {
        throw deviceCheckError;
      }
    }

    // Check if setting already exists for this device (or global)
    // For global settings, device_id is NULL
    let settingsQuery = supabase.from("settings").select("id");
    if (deviceId) {
      settingsQuery = settingsQuery.eq("device_id", deviceId);
    } else {
      settingsQuery = settingsQuery.is("device_id", null);
    }
    const { data: existingSettings, error: checkError } = await settingsQuery;

    if (checkError) {
      throw checkError;
    }

    if (existingSettings && existingSettings.length > 0) {
      // Setting exists, update ALL rows with this device_id
      let updateQuery = supabase.from("settings").update({
        max_weight: parseFloat(newMaxWeight),
        updated_by: updatedBy,
      });
      if (deviceId) {
        updateQuery = updateQuery.eq("device_id", deviceId);
      } else {
        updateQuery = updateQuery.is("device_id", null);
      }
      const { data, error } = await updateQuery.select();

      if (error) throw error;
      console.log(`[Settings] Updated ${data.length} setting(s) for device_id: ${deviceId || "global"}`);
    } else {
      // Setting doesn't exist - return error
      if (deviceId) {
        throw new Error(`Setting for device ${deviceId} not found. Please create the setting first.`);
      } else {
        throw new Error(`Global setting not found. Please create the setting first.`);
      }
    }

    // Publish settings update to device(s) via MQTT
    const settingsPayload = {
      max_weight: parseFloat(newMaxWeight),
      device_id: deviceId || "all",
      timestamp: new Date().toISOString(),
    };

    // Log control command for settings update
    await logControlCommand(deviceId || "all", "settings_update", settingsPayload, updatedBy);

    broker.publish({
      topic: MQTT_TOPICS.SETTINGS,
      payload: JSON.stringify(settingsPayload),
      qos: 1,
    });

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
    const { weight, device_id } = weightData;
    const currentWeight = parseFloat(weight);
    const deviceId = device_id || "default_device";

    // Get current max weight for this specific device
    const maxWeight = await getMaxWeight(deviceId);

    // Get previous status to detect state changes
    const previousStatus = await getDeviceStatus(deviceId);
    const previousOverload = previousStatus.is_overload || false;

    // Check if overload
    const isOverload = currentWeight > maxWeight;

    // Log event if state changed (overload or recovery)
    if (previousOverload !== isOverload) {
      const eventType = isOverload ? "overload" : "recovery";
      const { error: eventError } = await supabase.from("events").insert({
        device_id: deviceId,
        event_type: eventType,
        weight: currentWeight,
        max_weight: maxWeight,
      });

      if (eventError) {
        console.error("Error logging event:", eventError);
      } else {
        console.log(`[Weight Service] Event logged: ${eventType} - ${currentWeight}kg`);
      }
    }

    // Log weight data
    const { error: logError } = await supabase.from("weight_logs").insert({
      weight: currentWeight,
      is_overload: isOverload,
      device_id: deviceId,
    });

    if (logError) {
      console.error("Error logging weight:", logError);
    }

    // Update device status
    const { error: statusError } = await supabase.from("device_status").upsert(
      {
        device_id: deviceId,
        current_weight: currentWeight,
        is_overload: isOverload,
        motor_enabled: !isOverload, // Motor hanya enabled jika tidak overload
        alarm_active: isOverload, // Alarm aktif jika overload
        last_update: new Date().toISOString(),
      },
      {
        onConflict: "device_id",
      }
    );

    if (statusError) {
      console.error("Error updating device status:", statusError);
    }

    // Send control commands to device via MQTT
    const controlCommand = {
      device_id: deviceId,
      motor_enabled: !isOverload,
      alarm_enabled: isOverload,
      max_weight: maxWeight,
      current_weight: currentWeight,
      is_overload: isOverload,
      timestamp: new Date().toISOString(),
    };

    // Log control command
    await logControlCommand(deviceId, "motor_control", controlCommand, "system");

    broker.publish({
      topic: MQTT_TOPICS.CONTROL,
      payload: JSON.stringify(controlCommand),
      qos: 1,
    });

    console.log(`[Weight Service] Processed: ${currentWeight}kg / ${maxWeight}kg - Overload: ${isOverload}`);

    return {
      success: true,
      current_weight: currentWeight,
      max_weight: maxWeight,
      is_overload: isOverload,
      motor_enabled: !isOverload,
      alarm_enabled: isOverload,
    };
  } catch (error) {
    console.error("Error processing weight data:", error);
    throw error;
  }
}

/**
 * Get current device status
 */
export async function getDeviceStatus(deviceId = "default_device") {
  try {
    const { data, error } = await supabase.from("device_status").select("*").eq("device_id", deviceId).single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found

    if (!data) {
      return {
        device_id: deviceId,
        current_weight: 0,
        is_overload: false,
        motor_enabled: false,
        alarm_active: false,
        last_update: null,
      };
    }

    return data;
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
      .from("weight_logs")
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
 * Auto-creates default settings for new devices
 */
export async function registerDevice(deviceData) {
  try {
    const { device_id, name, location } = deviceData;

    if (!device_id) {
      throw new Error("device_id is required");
    }

    // Check if device already exists
    const { data: existingDevice } = await supabase.from("devices").select("device_id").eq("device_id", device_id).single();

    const isNewDevice = !existingDevice;

    // Register/update device
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

    // Auto-create default settings for new devices
    if (isNewDevice) {
      try {
        // Get global default max_weight (or use 500.0 as fallback)
        let defaultMaxWeight = 500.0;
        try {
          const globalMaxWeight = await getMaxWeight();
          defaultMaxWeight = globalMaxWeight;
        } catch (err) {
          console.log("[Register Device] Using default max_weight: 500.0");
        }

        // Insert default setting for this device
        const { error: settingsError } = await supabase.from("settings").insert({
          device_id: device_id,
          max_weight: defaultMaxWeight,
          updated_by: "system",
        });

        if (settingsError) {
          // Log error but don't fail device registration
          console.error(`[Register Device] Failed to create default settings for ${device_id}:`, settingsError);
        } else {
          console.log(`[Register Device] Auto-created default settings for ${device_id} with max_weight: ${defaultMaxWeight}`);
        }
      } catch (settingsErr) {
        // Log error but don't fail device registration
        console.error(`[Register Device] Error creating default settings:`, settingsErr);
      }
    }

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

    // Get last telemetry (weight_logs)
    const { data: lastTelemetry, error: telemetryError } = await supabase.from("weight_logs").select("*").eq("device_id", deviceId).order("timestamp", { ascending: false }).limit(1).single();

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
 * Get events (overload & recovery logs)
 */
export async function getEvents(deviceId = null, limit = 100, offset = 0) {
  try {
    let query = supabase
      .from("events")
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
    console.error("Error getting events:", error);
    throw error;
  }
}

/**
 * Send control command to device via MQTT
 */
export async function sendControlCommand(deviceId, commandData, sentBy = "mobile_app") {
  try {
    const { motor_enabled, alarm_enabled, direction, speed, ...otherData } = commandData;

    const controlCommand = {
      device_id: deviceId,
      motor_enabled: motor_enabled !== undefined ? motor_enabled : null,
      alarm_enabled: alarm_enabled !== undefined ? alarm_enabled : null,
      direction: direction !== undefined ? direction : null,
      speed: speed !== undefined ? speed : null,
      ...otherData,
      timestamp: new Date().toISOString(),
    };

    // Determine command type
    let commandType = "manual_control";
    if (direction !== undefined) {
      // Direction control (forward, reverse, stop)
      commandType = "movement_control";
    } else if (motor_enabled !== undefined && alarm_enabled !== undefined) {
      commandType = "motor_control";
    } else if (alarm_enabled !== undefined) {
      commandType = "alarm_control";
    }

    // Log control command
    await logControlCommand(deviceId, commandType, controlCommand, sentBy);

    // Publish to MQTT
    broker.publish({
      topic: MQTT_TOPICS.CONTROL,
      payload: JSON.stringify(controlCommand),
      qos: 1,
    });

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
async function logControlCommand(deviceId, commandType, commandData, sentBy) {
  try {
    const { error } = await supabase.from("control_logs").insert({
      device_id: deviceId,
      command_type: commandType,
      command_data: commandData,
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
      .from("control_logs")
      .select("*")
      .order("sent_at", { ascending: false })
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
