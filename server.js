// server.js

require("dotenv").config();

const TTN_CONFIG = {
  region: process.env.TTN_REGION,
  applicationId: process.env.TTN_APP_ID,
  apiKey: process.env.TTN_API_KEY,
  deviceId: process.env.TTN_DEVICE_ID || "",
};

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mqtt = require("mqtt");
const path = require("path");
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// InfluxDB setup
const influxDB = new InfluxDB({
  url: process.env.INFLUXDB_URL,
  token: process.env.INFLUXDB_TOKEN,
});
const writeApi = influxDB.getWriteApi(
  process.env.INFLUXDB_ORG,
  process.env.INFLUXDB_BUCKET,
  "ms" // Millisecond precision
);
const queryApi = influxDB.getQueryApi(process.env.INFLUXDB_ORG);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Function to calculate mode
function calculateMode(values) {
  const counts = {};
  let maxCount = 0;
  let mode = [];

  values.forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
    if (counts[value] > maxCount) {
      maxCount = counts[value];
      mode = [value];
    } else if (counts[value] === maxCount) {
      mode.push(value);
    }
  });

  return mode.length === Object.keys(counts).length ? [] : mode;
}

// Function to establish MQTT connection
function connectToTTN() {
  const brokerUrl = `mqtts://${TTN_CONFIG.region}.cloud.thethings.network:8883/mqtt`;

  console.log(`Connecting to MQTT broker: ${brokerUrl}`);

  const mqttClient = mqtt.connect(brokerUrl, {
    username: TTN_CONFIG.applicationId,
    password: TTN_CONFIG.apiKey,
    clientId: "nodejs_server_" + Math.random().toString(16).substr(2, 8),
  });

  mqttClient.on("connect", () => {
    console.log("Connected to TTN MQTT broker");

    // Create topic based on deviceId if provided
    let topic = `v3/${TTN_CONFIG.applicationId}/devices/+/up`;
    if (TTN_CONFIG.deviceId) {
      topic = `v3/${TTN_CONFIG.applicationId}/devices/${TTN_CONFIG.deviceId}/up`;
    }

    // Subscribe to the topic
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        console.error("Subscription error:", err);
        return;
      }

      console.log("Subscribed to:", topic);
    });
  });

  mqttClient.on("message", (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const decodedPayload = payload.uplink_message?.decoded_payload;

      if (decodedPayload) {
        const point = new Point("sensor_data")
          .tag("device_id", payload.end_device_ids.device_id)
          .floatField("tvoc", decodedPayload.tvoc)
          .floatField("humidity", decodedPayload.Humidity)
          .floatField("pressure", decodedPayload.Pressure)
          .timestamp(new Date(payload.received_at));

        writeApi.writePoint(point);
        console.log("Stored data in InfluxDB:", decodedPayload);
      }

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "message",
              topic: topic,
              payload: payload,
            })
          );
        }
      });
    } catch (e) {
      console.error("Error parsing MQTT message:", e);
    }
  });

  mqttClient.on("message", (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      console.log("Received message on topic:", topic);

      // Broadcast to all connected WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "message",
              topic: topic,
              payload: payload,
            })
          );
        }
      });
    } catch (e) {
      console.error("Error parsing MQTT message:", e);
    }
  });

  mqttClient.on("error", (err) => {
    console.error("MQTT error:", err);
  });

  mqttClient.on("close", () => {
    console.log(
      "MQTT connection closed, attempting to reconnect in 5 seconds..."
    );
    setTimeout(connectToTTN, 5000);
  });

  return mqttClient;
}

// Historical data endpoint (2 days)
app.get("/api/historical", async (req, res) => {
  const fluxQuery = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -2d)
      |> filter(fn: (r) => r._measurement == "sensor_data")
      |> filter(fn: (r) => r.device_id == "${TTN_CONFIG.deviceId}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
  `;

  try {
    const rows = [];
    await queryApi.collectRows(fluxQuery, (row) => {
      rows.push({
        received_at: row._time,
        uplink_message: {
          decoded_payload: {
            tvoc: row.tvoc,
            Humidity: row.humidity,
            Pressure: row.pressure,
          },
        },
        end_device_ids: { device_id: row.device_id },
      });
    });
    res.json(rows);
  } catch (error) {
    console.error("Error querying InfluxDB:", error);
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

// Store global MQTT client reference
let globalMqttClient = null;

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Connect to TTN MQTT broker
  globalMqttClient = connectToTTN();
});

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  // Send connection success message immediately
  ws.send(
    JSON.stringify({
      type: "connection",
      status: "connected",
    })
  );

  // Handle client disconnection
  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  writeApi.close().then(() => {
    console.log("InfluxDB write API closed");
    process.exit(0);
  });
});
