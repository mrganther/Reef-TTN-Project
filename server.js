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

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Store connected clients
const clients = new Set();

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("WebSocket client connected");
  clients.add(ws);

  // Handle client connection configuration
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      // If client is requesting MQTT connection
      if (data.action === "connect") {
        // Disconnect existing MQTT client if any
        if (ws.mqttClient) {
          ws.mqttClient.end();
        }

        // Connect to TTN MQTT broker
        const region = data.region || "eu1";
        const applicationId = data.applicationId;
        const apiKey = data.apiKey;
        const brokerUrl = `mqtts://${region}.cloud.thethings.network:8883/mqtt`;

        console.log(`Connecting to MQTT broker: ${brokerUrl}`);

        const mqttClient = mqtt.connect(brokerUrl, {
          username: applicationId,
          password: apiKey,
          clientId: "nodejs_server_" + Math.random().toString(16).substr(2, 8),
        });

        // Save client reference
        ws.mqttClient = mqttClient;

        mqttClient.on("connect", () => {
          console.log("Connected to TTN MQTT broker");

          // Create topic based on deviceId if provided
          let topic = `v3/${applicationId}/devices/+/up`;
          if (data.deviceId) {
            topic = `v3/${applicationId}/devices/${data.deviceId}/up`;
          }

          // Subscribe to the topic
          mqttClient.subscribe(topic, (err) => {
            if (err) {
              console.error("Subscription error:", err);
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Failed to subscribe: " + err.message,
                })
              );
              return;
            }

            console.log("Subscribed to:", topic);
            ws.send(
              JSON.stringify({ type: "connection", status: "connected" })
            );
          });
        });

        mqttClient.on("message", (topic, message) => {
          try {
            const payload = JSON.parse(message.toString());
            console.log("Received message on topic:", topic);

            // Forward to WebSocket client
            ws.send(
              JSON.stringify({
                type: "message",
                topic: topic,
                payload: payload,
              })
            );
          } catch (e) {
            console.error("Error parsing MQTT message:", e);
          }
        });

        mqttClient.on("error", (err) => {
          console.error("MQTT error:", err);
          ws.send(
            JSON.stringify({
              type: "error",
              message: "MQTT error: " + err.message,
            })
          );
        });

        mqttClient.on("close", () => {
          console.log("MQTT connection closed");
          ws.send(
            JSON.stringify({ type: "connection", status: "disconnected" })
          );
        });
      }

      // If client is requesting MQTT disconnection
      if (data.action === "disconnect" && ws.mqttClient) {
        ws.mqttClient.end();
        ws.mqttClient = null;
        ws.send(JSON.stringify({ type: "connection", status: "disconnected" }));
      }
    } catch (e) {
      console.error("Error processing WebSocket message:", e);
    }
  });

  // Handle WebSocket client disconnect
  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    if (ws.mqttClient) {
      ws.mqttClient.end();
    }
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
