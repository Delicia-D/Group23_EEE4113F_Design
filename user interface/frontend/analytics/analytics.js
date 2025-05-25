let penguinDataGlobal = [];
let weightChartInstance = null;

async function loadSummaryStats() {
  try {
    const response = await fetch("https://penguin-monitoring-backend.onrender.com/api/penguins");
    const data = await response.json();
    console.log("DATA received:", data);

    if (!Array.isArray(data)) throw new Error("Data is not an array");

    penguinDataGlobal = data;

    const total = data.length;
    const weights = data.map(p => p.latest_weight);
    const avgWeight = (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1);

    const outliers = data.filter(p => p.latest_weight > 70 || p.latest_weight < 30);
   const threshold = parseFloat(document.getElementById("thresholdSlider")?.value || 4);
const underweightPenguins = data.filter(p => p.latest_weight < threshold);

    const avgUnderweight = (
      underweightPenguins.reduce((sum, p) => sum + p.latest_weight, 0) / underweightPenguins.length || 0
    ).toFixed(1);

    // Update summary cards
    document.getElementById("totalPenguins").textContent = total;
    document.getElementById("avgWeight").textContent = `${avgWeight} kg`;
    document.getElementById("outlierCount").textContent = outliers.length;
   

    // Setup outlier card hover
    const outlierCard = document.querySelector("#outlierCount").parentElement;
    outlierCard.addEventListener("mouseenter", () => {
      const panel = document.getElementById("outlierPanel");
      const list = document.getElementById("outlierList");
      
      panel.querySelector("h3").textContent = "Outlier Penguins";
      list.innerHTML = outliers.map(p => 
        `<p><strong>${p.rfid}</strong> - ${p.latest_weight} kg</p>`
      ).join("");
      
      panel.classList.remove("hidden");
      panel.classList.add("visible");
    });

    outlierCard.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!document.querySelector("#outlierPanel").matches(":hover")) {
          hidePanel();
        }
      }, 200);
    });

    const outlierPanel = document.getElementById("outlierPanel");
    outlierPanel.addEventListener("mouseleave", () => {
      hidePanel();
    });

    updateUnderweightSliderDisplay(data);
    renderHeatmap(data);

    
    const endDateInput = document.getElementById("endDate");
    const startDateInput = document.getElementById("startDate");
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    endDateInput.valueAsDate = today;
    startDateInput.valueAsDate = thirtyDaysAgo;
    
    renderWeightBarChart(data, startDateInput.value, endDateInput.value);

  } catch (err) {
    console.error("Error in loadSummaryStats:", err);
  }
}

function hidePanel() {
  const panel = document.getElementById("outlierPanel");
  panel.classList.remove("visible");
  panel.classList.add("hidden");
}

function filterDataByDateRange(data, startDate, endDate) {
  if (!startDate || !endDate) return data;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // Include the entire end day
  
  const penguinMap = new Map();
  
  data.forEach(penguin => {
    const penguinDate = new Date(penguin.last_seen);
    if (penguinDate >= start && penguinDate <= end) {
      if (!penguinMap.has(penguin.rfid)) {
        penguinMap.set(penguin.rfid, penguin);
      } else {
        const existingDate = new Date(penguinMap.get(penguin.rfid).last_seen);
        if (penguinDate > existingDate) {
          penguinMap.set(penguin.rfid, penguin);
        }
      }
    }
  });
  
  return Array.from(penguinMap.values());
}

function renderWeightBarChart(data, startDate, endDate) {
  const ctx = document.getElementById("weightBarChart").getContext("2d");
  const filteredData = startDate && endDate 
    ? filterDataByDateRange(data, startDate, endDate)
    : data;

  if (weightChartInstance) {
    weightChartInstance.destroy();
  }

  const sorted = [...filteredData]
    .sort((a, b) => b.latest_weight - a.latest_weight)
    .slice(0, 10);

  const labels = sorted.map(p => p.rfid);
  const weights = sorted.map(p => p.latest_weight);

  weightChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: weights,
          backgroundColor: "#0284c7",
          borderColor: "#0284c7",
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (context) => `Penguin: ${context[0].label}`,
            label: (context) => `Weight: ${context.parsed.x} kg`,
          },
        },
      },
      layout: {
        padding: {
          left: 20,
          right: 20,
          top: 20,
          bottom: 20,
        },
      },
      scales: {
        x: {
          display: true,
          beginAtZero: true,
          title: {
            display: true,
            text: "Weight (kg)",
            color: "#e0e0e0",
            font: {
              size: 14,
              weight: "bold",
            },
          },
          ticks: {
            display: true,
            color: "#e0e0e0",
            font: {
              size: 12,
            },
          },
          grid: {
            display: true,
            color: "rgba(255,255,255,0.1)",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Penguin ID",
            color: "#e0e0e0",
            font: {
              size: 14,
              weight: "bold",
            },
          },
          ticks: {
            display: true,
            color: "#e0e0e0",
            font: {
              size: 12,
              weight: "bold",
            },
            maxRotation: 0,
            minRotation: 0,
          },
          grid: {
            display: true,
            color: "rgba(255,255,255,0.1)",
          },
        },
      },
    },
  });
}
function updateUnderweightSliderDisplay(data) {
  const slider = document.getElementById("thresholdSlider");
  const sliderValueDisplay = document.getElementById("sliderValue");
  const underweightResult = document.getElementById("underweightResult");
  const avgUnderweightDisplay = document.getElementById("avgUnderweight");
  const progressBar = document.getElementById("underweightBar");

  if (!slider || !sliderValueDisplay || !underweightResult || !avgUnderweightDisplay || !progressBar) {
    console.warn("Missing DOM elements.");
    return;
  }

  const threshold = parseFloat(slider.value);
  const underweightPenguins = data.filter(p => p.latest_weight < threshold);

  // Update summary display
  sliderValueDisplay.textContent = threshold.toFixed(1);
  underweightResult.textContent = `${underweightPenguins.length} penguins`;
  progressBar.value = underweightPenguins.length;

  // Dynamically calculate avg underweight
  const avgUnderweight = (
    underweightPenguins.reduce((sum, p) => sum + p.latest_weight, 0) / underweightPenguins.length || 0
  ).toFixed(1);
  avgUnderweightDisplay.textContent = `${avgUnderweight} kg`;

  // Update right panel with underweight list
  const panel = document.getElementById("outlierPanel");
  const list = document.getElementById("outlierList");
  const header = panel.querySelector("h3");

  header.textContent = `Underweight Penguins (< ${threshold.toFixed(1)} kg)`;
  list.innerHTML = underweightPenguins.map(p => 
    `<p><strong>${p.rfid}</strong> - ${p.latest_weight} kg</p>`
  ).join("");

  panel.classList.remove("hidden");
  panel.classList.add("visible");
}



function showPenguinDetails(penguin) {
  const panel = document.getElementById("outlierPanel");
  const list = document.getElementById("outlierList");
  
  // Update panel title
  const header = panel.querySelector("h3");
  header.textContent = `Penguin ${penguin.rfid}`;
  
  // Create detailed content
  const now = new Date();
  const lastSeen = new Date(penguin.last_seen);
  const daysAgo = Math.floor((now - lastSeen) / (1000 * 60 * 60 * 24));
  
  list.innerHTML = `
    <p><strong>Last Seen:</strong> ${daysAgo} days ago</p>
    <p><strong>Weight:</strong> ${penguin.latest_weight} kg</p>
 
    <p><strong>Status:</strong> ${getStatusText(daysAgo)}</p>
  `;
  
  panel.classList.remove("hidden");
  panel.classList.add("visible");
}

function getStatusText(days) {
  if (days <= 1) return "Active (very recent)";
  if (days <= 7) return "Active (Recent)";
  if (days <= 30) return "Inactive";
  return "Inactive (Overdue)";
}

function renderHeatmap(data) {
  const grid = document.getElementById("heatmapGrid");
  grid.innerHTML = "";

  const now = new Date();
  const buckets = [1, 7, 14, 30, 120];
  const table = document.createElement("table");
  table.classList.add("heatmap-table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `<th>Penguin</th>` + buckets.map(b => `<th>≤ ${b}d</th>`).join("");
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  data.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><strong>${p.rfid}</strong></td>`;
    const lastSeen = new Date(p.last_seen);
    const daysAgo = Math.floor((now - lastSeen) / (1000 * 60 * 60 * 24));

   let bucketMatched = false;
buckets.forEach(b => {
  const cell = document.createElement("td");

  if (!bucketMatched && daysAgo <= b) {
    let status = "";
    if (daysAgo <= 1) {
      status = "fresh";
    } else if (daysAgo <= 7) {
      status = "recent";
    } else {
      status = "stale";
    }
    cell.className = `heatmap-cell ${status}`;
    cell.title = `${p.rfid} - Last seen ${daysAgo} days ago`;
    cell.addEventListener("mouseenter", () => showPenguinDetails(p));
    bucketMatched = true;
  } else {
    cell.className = "heatmap-cell";
  }

  row.appendChild(cell);
});


    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  grid.appendChild(table);
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("closeOutlierBtn");
  const slider = document.getElementById("thresholdSlider");
  const applyBtn = document.getElementById("applyDateRange");

  if (closeBtn) {
    closeBtn.addEventListener("click", hidePanel);
  }

  if (slider) {
    slider.addEventListener("input", () => {
      updateUnderweightSliderDisplay(penguinDataGlobal);
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const startDate = document.getElementById("startDate").value;
      const endDate = document.getElementById("endDate").value;
      renderWeightBarChart(penguinDataGlobal, startDate, endDate);
    });
  }

  loadSummaryStats();
});
// Theme toggle functionality (add this to analytics.js)
document.getElementById('themeToggle').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleTheme();
});
function toggleTheme() {
  const body = document.body;
  const mainLightMode = document.getElementById('light-mode-stylesheet');
  const analyticsLightMode = document.getElementById('light-mode-analytics-stylesheet');
  const themeIcon = document.querySelector('#themeToggle i');
  
  if (body.classList.contains('light-mode')) {
    // Switching to dark mode
    body.classList.remove('light-mode');
    mainLightMode.disabled = true;
    analyticsLightMode.disabled = true;
    localStorage.setItem('themePreference', 'dark');
    themeIcon.classList.replace('fa-sun', 'fa-moon');
  } else {
    // Switching to light mode
    body.classList.add('light-mode');
    mainLightMode.disabled = false;
    analyticsLightMode.disabled = false;
    localStorage.setItem('themePreference', 'light');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
  }
}

function checkSavedTheme() {
  const savedTheme = localStorage.getItem('themePreference');
  const mainLightMode = document.getElementById('light-mode-stylesheet');
  const analyticsLightMode = document.getElementById('light-mode-analytics-stylesheet');
  
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    mainLightMode.disabled = false;
    analyticsLightMode.disabled = false;
    document.querySelector('#themeToggle i').classList.replace('fa-moon', 'fa-sun');
  }
}
document.addEventListener('DOMContentLoaded', checkSavedTheme);
