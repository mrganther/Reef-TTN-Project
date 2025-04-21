document.addEventListener("DOMContentLoaded", function () {
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");
  const messageList = document.getElementById("messageList");
  const reefDeviceName = "Reef Device 01";

  let ws = null;
  const messageHistory = [];
  const MAX_MESSAGES = 50;

  // Data storage
  const maxDataPoints = 12;
  const temperatures = [];
  const timestamps = [];

  // Chart.js Setup
  const ctx = document.getElementById("temperatureChartOld").getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: timestamps,
      datasets: [
        {
          label: "Temperature (°C)",
          data: temperatures,
          borderColor: "#007bff",
          backgroundColor: "rgba(0, 123, 255, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        xAxes: [
          { display: true, scaleLabel: { display: true, labelString: "Time" } },
        ],
        yAxes: [
          {
            display: true,
            scaleLabel: { display: true, labelString: "Temperature (°C)" },
          },
        ],
      },
      plugins: { legend: { display: true } },
    },
  });

  
  // Connect immediately when page loads
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

            // Update Chart data

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

  // Keep the message history functions unchanged...
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

    // Update Temp Chart
    // updateTemperatureChart();
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

  /*function updateTemperatureChart() {
    const newData = messageHistory.at(0);
    const temperature = newData.data.uplink_message.decoded_payload.Temp; 
    const receivedAt = new Date(newData.data.received_at);

    // Add new data
    temperatures.push(temperature);
    timestamps.push(receivedAt.toLocaleTimeString());

    // Limit data to maxDataPoints
    if (temperatures.length > maxDataPoints) {
      temperatures.shift();
      timestamps.shift();
    }

    // Update chart
    chart.data.labels = timestamps;
    chart.update();
    chart.data.datasets[0].data = temperatures;
  }*/
});
