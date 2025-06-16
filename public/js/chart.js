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
  const newData = messageHistory.at(0);
  const newTemperature = newData.data.uplink_message.decoded_payload.Temp;
  const newHumidity = newData.data.uplink_message.decoded_payload.Humidity;
  const newPressure = newData.data.uplink_message.decoded_payload.Pressure;
  const receivedAt = new Date(newData.data.received_at);

  // Add new data
  timestamps.push(receivedAt.toLocaleTimeString());
  data.temperature.push(newTemperature);
  data.humidity.push(newHumidity);
  data.pressure.push(newPressure);

  // Remove old data if exceeding max points
  if (timestamps.length > maxDataPoints) {
    timestamps.shift();
    data.temperature.shift();
    data.humidity.shift();
    data.pressure.shift();
  }

  // Update all charts
  charts.forEach((chart) => chart.update());
}
