const messageHistory = [];
const MAX_MESSAGES = 50;

// Data storage
const maxDataPoints = 12;
const temperatures = [];
const data = {
  humidity: [],
  pressure: [],
  temperature: [],
};
const timestamps = [];

// Chart Config
const chartConfigs = [
  {
    id: "temperatureChart",
    dataKey: "temperature",
    label: "Temperature (°C)",
    borderColor: "#007bff",
    backgroundColor: "rgba(0, 123, 255, 0.1)",
    yAxisLabel: "Temperature (°C)",
  },
  {
    id: "humidityChart",
    dataKey: "humidity",
    label: "Humidity (%)",
    borderColor: "#28a745",
    backgroundColor: "rgba(40, 167, 69, 0.1)",
    yAxisLabel: "Humidity (%)",
  },
  {
    id: "pressureChart",
    dataKey: "pressure",
    label: "Pressure (hPa)",
    borderColor: "#dc3545",
    backgroundColor: "rgba(220, 53, 69, 0.1)",
    yAxisLabel: "Pressure (hPa)",
  },
];

function createChart(config) {
  const ctx = document.getElementById(config.id).getContext("2d");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: timestamps,
      datasets: [
        {
          label: config.label,
          data: data[config.dataKey],
          borderColor: config.borderColor,
          backgroundColor: config.backgroundColor,
          fill: true,
          tension: 0,
          pointRadius: 5,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Time",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: config.yAxisLabel,
          },
        },
      },
      plugins: {
        legend: { display: true },
      },
    },
  });
}

const charts = chartConfigs.map((config) => createChart(config));

function updateAllCharts(messageHistory) {
  // Clear existing chart data
  timestamps.length = 0;
  data.temperature.length = 0;
  data.humidity.length = 0;
  data.pressure.length = 0;

  // Sort messages by received_at (oldest first for charts)
  const sortedMessages = [...messageHistory].sort(
    (a, b) => new Date(a.data.received_at) - new Date(b.data.received_at)
  );
  
  // Add data up to maxDataPoints (newest messages)
  sortedMessages.slice(-maxDataPoints).forEach((msg) => {
    const newTemperature = msg.data.uplink_message.decoded_payload.tvoc;
    const newHumidity = msg.data.uplink_message.decoded_payload.Humidity;
    const newPressure = msg.data.uplink_message.decoded_payload.Pressure;
    const receivedAt = new Date(msg.data.received_at);

    timestamps.push(receivedAt.toLocaleTimeString());
    data.temperature.push(newTemperature);
    data.humidity.push(newHumidity);
    data.pressure.push(newPressure);
  });

  // Update all charts
  charts.forEach((chart) => chart.update());
}
