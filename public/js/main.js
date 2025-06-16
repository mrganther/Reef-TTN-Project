document.addEventListener("DOMContentLoaded", function () {
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");
  const messageList = document.getElementById("messageList");
  const reefDeviceName = "Reef Device 01";

  let ws = null;
  const messageHistory = [];
  const MAX_MESSAGES = 50;

  connectWebSocket();

  function connectWebSocket() {
    // Update UI to connecting state
    statusText.innerText = "Connecting...";
    statusIndicator.classList.remove("connected");

    try {
      // Create WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}`;

      ws = new WebSocket(wsUrl);

      ws.onopen = function () {
        console.log("WebSocket connection established");
      };

      ws.onmessage = function (event) {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connection") {
            if (data.status === "connected") {
              statusIndicator.classList.add("connected");
              statusText.innerText = "Connected to " + reefDeviceName;
            } else {
              statusIndicator.classList.remove("connected");
              statusText.innerText = "Disconnected from " + reefDeviceName;
              // Try to reconnect after a delay
              setTimeout(connectWebSocket, 5000);
            }
          }

          if (data.type === "message" && data.payload) {
            console.log("Received data:", data.payload);

            // Add to history
            addToMessageHistory(data.payload);
          }

          if (data.type === "error") {
            console.error("Server error:", data.message);
            statusText.innerText = "Error: " + data.message;
            statusIndicator.classList.remove("connected");
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onerror = function (error) {
        console.error("WebSocket error:", error);
        statusText.innerText = "Connection error";
        statusIndicator.classList.remove("connected");
      };

      ws.onclose = function () {
        console.log("WebSocket connection closed");
        statusIndicator.classList.remove("connected");
        statusText.innerText = "Disconnected";
        // Try to reconnect after a delay
        setTimeout(connectWebSocket, 5000);
      };
    } catch (e) {
      console.error("Connection error:", e);
      statusText.innerText = "Error: " + e.message;
      // Try to reconnect after a delay
      setTimeout(connectWebSocket, 5000);
    }
  }

  function addToMessageHistory(data) {
    const now = new Date();
    messageHistory.unshift({
      timestamp: now,
      data: data,
    });

    // Limit history size
    if (messageHistory.length > MAX_MESSAGES) {
      messageHistory.pop();
    }

    // Update UI
    updateMessageHistoryUI();
  }

  function updateMessageHistoryUI() {
    messageList.innerHTML = "";

    messageHistory.forEach(function (msg) {
      const msgElement = document.createElement("div");
      msgElement.className = "message-item";

      let deviceId = "unknown";
      let received = msg.timestamp.toLocaleTimeString();

      if (
        msg.data &&
        msg.data.end_device_ids &&
        msg.data.end_device_ids.device_id
      ) {
        deviceId = msg.data.end_device_ids.device_id;
      }

      if (msg.data && msg.data.received_at) {
        const receivedDate = new Date(msg.data.received_at);
        received = receivedDate.toLocaleTimeString();
      }

      // Extract payload data if available
      let payloadData = "No decoded payload";
      if (
        msg.data &&
        msg.data.uplink_message &&
        msg.data.uplink_message.decoded_payload
      ) {
        payloadData = JSON.stringify(msg.data.uplink_message.decoded_payload);
      }

      msgElement.innerHTML = `
                    <div><strong>Device:</strong> ${deviceId}</div>
                    <div><strong>Received:</strong> ${received}</div>
                    <div><strong>Data:</strong> ${payloadData}</div>
                    <div class="timestamp">Local time: ${msg.timestamp.toLocaleString()}</div>
                `;

      messageList.appendChild(msgElement);
    });

    updateAllCharts(messageHistory);
  }
});
