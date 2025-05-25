// script.js
let latestKnownCount = 0;
const app = document.getElementById("app");
let currentPenguinState = [];
let baselineSet = false;
let penguinData = []; // store all fetched penguins
let currentPage = 1;
const rowsPerPage = 10;
let currentNotesPenguinId = null;
function comparePenguinStates(oldState, newState) {
  let changes = 0;
  const oldMap = new Map(oldState.map(p => [p.rfid, p]));
  const newMap = new Map(newState.map(p => [p.rfid, p]));

  for (const [rfid, newPenguin] of newMap) {
    const oldPenguin = oldMap.get(rfid);
    if (!oldPenguin) {
      changes++;
    } else {
      if (
        oldPenguin.visit_count !== newPenguin.visit_count ||
        oldPenguin.latest_weight !== newPenguin.latest_weight ||
        oldPenguin.last_seen !== newPenguin.last_seen
      ) {
        changes++;
      }
    }
  }

  for (const [rfid] of oldMap) {
    if (!newMap.has(rfid)) {
      changes++;
    }
  }

  return changes;
}function loadPenguins(setAsCurrent = false) {
  fetch("https://penguin-monitoring-backend.onrender.com/api/penguins")
    .then(res => res.json())
    .then(data => {
      penguinData = data;       // store for pagination
      renderTable();          

   
      let latestPenguin = null;
      let latestPenguinVisit = null;

      penguinData.forEach(p => {
        if (p.visits) {
          p.visits.forEach(v => {
            if (!latestPenguinVisit || new Date(v.timestamp) > new Date(latestPenguinVisit.timestamp)) {
              latestPenguinVisit = v;
              latestPenguin = p;
            }
          });
        }
      });

     
      const img = document.getElementById("latestPenguinImg");
      const info = document.getElementById("latestPenguinInfo");
      
      img.src = "";
      img.alt = "No image available";
      info.innerHTML = "<p>No penguin data available</p>";

      if (window.latestPenguinChartInstance) {
        window.latestPenguinChartInstance.destroy();
        window.latestPenguinChartInstance = null;
      }

      if (latestPenguin && latestPenguinVisit) {
        try {
          if (latestPenguinVisit.image_url) {
            img.src = latestPenguinVisit.image_url;
            img.alt = `Penguin ${latestPenguin.rfid}`;
          }

          info.innerHTML = `
            <p><strong>RFID:</strong> ${latestPenguin.rfid}</p>
            <p><strong>Total Visits:</strong> ${latestPenguin.visits?.length || 0}</p>
            <p><strong>Last Seen:</strong> ${new Date(latestPenguinVisit.timestamp).toLocaleString()}</p>
            <p><strong>Last Weight:</strong> ${latestPenguinVisit.weight} kg</p>
          `;

          if (latestPenguin.visits?.length > 0) {
            const visitsSorted = [...latestPenguin.visits].sort((a, b) =>
              new Date(a.timestamp) - new Date(b.timestamp));
            const labels = visitsSorted.map(v => new Date(v.timestamp).toLocaleDateString());
            const weights = visitsSorted.map(v => v.weight);

            const ctx = document.getElementById("dailyWeightChart").getContext("2d");
            window.latestPenguinChartInstance = new Chart(ctx, {
              type: 'line',
              data: {
                labels: labels,
                datasets: [{
                  label: "Weight (kg)",
                  data: weights,
                  borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-line-color'),
                  backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-fill-color'),
                  tension: 0.3,
                  pointRadius: 3,
                  fill: true
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { bottom: 30 } },
                scales: {
                  x: {
                    title: { display: true, text: "Date", color: "#ffffff", font: { size: 14, weight: 'bold' } },
                    ticks: { color: "#ffffff", maxRotation: 45, minRotation: 45 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                  },
                  y: {
                    title: { display: true, text: "Weight (kg)", color: "#ffffff", font: { size: 14, weight: 'bold' } },
                    ticks: { color: "#ffffff" },
                    grid: { color: 'rgba(89, 87, 87, 0.1)' },
                    beginAtZero: true
                  }
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#1e1e1e',
                    titleColor: '#0284c7',
                    bodyColor: "#ffffff",
                    borderColor: "#ffffff",
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                      label: function (context) {
                        return `${context.parsed.y} kg`;
                      }
                    }
                  }
                }
              }
            });
          }

        } catch (error) {
          console.error("Error processing latest penguin:", error);
          info.innerHTML = "<p style='color:red;'>Error displaying penguin data</p>";
        }
      }


      if (setAsCurrent) {
        currentPenguinState = data;
        document.getElementById("refreshBadge").textContent = "0";
        document.getElementById("refreshBadge").classList.add("hidden");
      } else if (currentPenguinState.length > 0) {
        const changeCount = comparePenguinStates(currentPenguinState, data);
        const badge = document.getElementById("refreshBadge");

        if (changeCount > 0) {
          badge.textContent = changeCount;
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }
    })
    .catch(err => {
      console.error("Failed to load penguins:", err);
      const info = document.getElementById("latestPenguinInfo");
      info.innerHTML = "<p style='color:red;'>Error loading penguin data</p>";
      app.innerHTML += "<p style='color:red;'>Failed to load penguin data.</p>";
    });
}


// Toggle filter dropdown
function toggleFilterDropdown() {
  const dropdown = document.getElementById("filterDropdown");
  dropdown.classList.toggle("open");
}

function closeFilterDropdown() {
  document.getElementById("filterDropdown").classList.remove("open");
}

function applyFilters() {
  const weightLimit = parseFloat(document.getElementById("weightFilter").value);
  const statusFilter = document.getElementById("statusFilter").value;
  const rows = document.querySelectorAll("#penguinTable tbody tr");

  rows.forEach(row => {
    const weight = parseFloat(row.children[1].textContent);
    const status = row.querySelector("select.statusDropdown")?.value;

    let show = true;

    if (!isNaN(weightLimit) && weight >= weightLimit) {
      show = false;
    }

    if (statusFilter && status !== statusFilter) {
      show = false;
    }

    row.style.display = show ? "" : "none";
  });

  closeFilterDropdown();
}

document.getElementById("applyFilterBtn").addEventListener("click", applyFilters);
function renderTable() {
  const tbody = document.querySelector("#penguinTable tbody");
  tbody.innerHTML = "";

  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = penguinData.slice(start, end);

  let latestPenguin = null;
  let latestPenguinVisit = null;

  pageData.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.rfid}</td>
      <td>${p.latest_weight} kg</td>
      <td>${p.last_seen}</td>
      <td>${p.visit_count}</td>
      <td>
        <select class="statusDropdown" data-id="${p.penguin_id}">
          <option value="normal" ${p.status === "normal" ? "selected" : ""}>Normal</option>
          <option value="critical" ${p.status === "critical" ? "selected" : ""}>Critical</option>
        </select>
        ${p.status === "critical" ? `<i class="fas fa-exclamation-triangle" style="color: #ff3d00; margin-left: 8px;"></i>` : ""}
      </td>
      <td>
        <button class="viewBtn" data-id="${p.penguin_id}" style="margin-right: 40px;">View</button>
        <button class="deleteBtn" data-id="${p.penguin_id}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  setupPagination();
  setupRowInteractions();
}


function showPenguinDetails(penguinId) {
  const modal = document.getElementById("modal");
  const body = document.getElementById("modal-body");

  modal.classList.remove("hidden");
  body.innerHTML = "Loading...";

  fetch(`https://penguin-monitoring-backend.onrender.com
/penguin/${penguinId}`)
    .then(res => res.json())
    .then(data => {
      const visits = data.visits.map(v => `
        <tr>
          <td>${v.visit_number}</td>
          <td>${new Date(v.timestamp).toLocaleDateString()}</td>
          <td>${new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
          <td>${v.weight} kg</td>
        </tr>
      `).join("");

     const images = data.visits.map(v => {
  const date = new Date(v.timestamp).toLocaleDateString();
  const imgSrc =  v.image_url;
  return `
    <div class="image-card">
      <img 
        src="${imgSrc}" 
        alt="Visit image on ${date}" 
        class="zoomable-image" 
        data-full="${imgSrc}" 
        style="cursor: pointer;"
      />
      <div class="img-label">Visit on ${date}</div>
    </div>
  `;
}).join("");


      body.innerHTML = `
        <div class="penguin-top-section">
          <div class="penguin-info">
            <h2>Penguin Overview</h2>
            <p><strong>Penguin ID:</strong> ${data.penguin_id}</p>
            <p><strong>RFID Tag:</strong> ${data.rfid}</p>
            <p><strong>Total Visits:</strong> ${data.visits.length}</p>
          </div>
          
          <div class="penguin-chart">
            <h3>Weight Over Time</h3>
            <canvas id="weightChart" height="180"></canvas>
          </div>
        </div>
    
        <table>
          <thead>
            <tr><th>Visit #</th><th>Date</th><th>Time</th><th>Weight</th></tr>
          </thead>
          <tbody>${visits}</tbody>
        </table>

        <h3>Image Gallery</h3>
        <div>${images}</div>

        <br>
        <a href="https://penguin-monitoring-backend.onrender.com/penguin/${data.penguin_id}/download" target="_blank">
          <button>Download All Visits (CSV)</button>
        </a>
        <h3 style="cursor: pointer;" onclick="toggleNotes()" id="notesHeader">
  <i id="notesIcon" class="fas fa-plus-square"></i> Researcher Notes
</h3>
<div id="penguin-notes-wrapper" style="display: none;">
  <div id="penguin-notes-section" class="notes-list"></div>
  <textarea id="penguin-note-input" placeholder="Add a new note..."></textarea>
  <button onclick="submitPenguinNote()">Submit Note</button>
</div>


        
      `;
currentNotesPenguinId = data.penguin_id;
loadPenguinNotes(currentNotesPenguinId);

      if (window.weightChartInstance) {
        window.weightChartInstance.destroy();
      }

      const ctx = document.getElementById('weightChart').getContext('2d');
      window.weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.visits.map(v => new Date(v.timestamp).toLocaleDateString()),
          datasets: [{
            label: 'Weight (kg)',
            data: data.visits.map(v => v.weight),
            borderColor: '#0077b6',
            backgroundColor: 'rgba(0, 119, 182, 0.1)',
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true
          }]
        },
        options: {
  scales: {
    x: {
      title: {
        display: true,
        text: 'Date',
        color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text-color')

      },
      ticks: {
        color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text-color')
      },
      grid: {
      color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid-color')      }
    },
    y: {
      title: {
        display: true,
        text: 'Weight (kg)',
        color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text-color')
      },
      ticks: {
        color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text-color')
      },
      grid: {
  color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid-color')      },
      beginAtZero: true
    }
  },
  plugins: {
    legend: {
      display: false
    }
  }
}

      });
    })
    .catch(err => {
      body.innerHTML = `<p style="color:red;">Failed to load penguin details.</p>`;
      console.error(err);
    });
}

document.querySelector(".close-btn").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
});

document.getElementById("refreshBtn").addEventListener("click", function() {
  loadPenguins(true);
});

loadPenguins(true);
document.getElementById("applyFilterBtn").addEventListener("click", applyFilters);


document.querySelectorAll(".deleteBtn").forEach(button => {
  button.addEventListener("click", () => {
    const id = button.dataset.id;
    if (confirm("Are you sure you want to delete this penguin?")) {
      fetch(`https://penguin-monitoring-backend.onrender.com
/penguin/${id}`, {
        method: "DELETE"
      })
        .then(res => {
          if (res.ok) {
            alert("Penguin deleted.");
            loadPenguins(true); // refresh table
          } else {
            alert("Failed to delete penguin.");
          }
        })
        .catch(err => {
          console.error(err);
          alert("Error deleting penguin.");
        });
    }
  });
});


async function refreshData() {
  await loadPenguins(true); // Reloads and updates display + clears badge
}

setInterval(checkForNewData, 5000); // check every 30 seconds
document.getElementById("refreshBtn").addEventListener("click", async () => {
  await refreshData();
  try {
    const res = await fetch('https://penguin-monitoring-backend.onrender.com/api/visit-count');
    const data = await res.json();
    latestVisitCount = data.count;
  } catch (error) {
    console.error("Error refreshing visit count:", error);
  }

  document.getElementById("refreshBadge").classList.add("hidden");
});
async function checkForNewData() {
  try {
    const res = await fetch("https://penguin-monitoring-backend.onrender.com/api/penguins");
    const newData = await res.json();
    const changes = comparePenguinStates(currentPenguinState, newData);
    const badge = document.getElementById("refreshBadge");

    if (changes > 0) {
      badge.textContent = changes;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  } catch (err) {
    console.error("Error checking for new data:", err);
  }
}
// Zoom image when clicked
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("zoomable-image")) {
    const fullSrc = e.target.getAttribute("data-full");
    document.getElementById("lightboxImg").src = fullSrc;
    document.getElementById("imageLightbox").classList.remove("hidden");
  }
});

function closeImageLightbox() {
  document.getElementById("imageLightbox").classList.add("hidden");
  document.getElementById("lightboxImg").src = "";
}function setupPagination() {
  const totalPages = Math.ceil(penguinData.length / rowsPerPage);
  const pageIndicator = document.getElementById("pageIndicator");
  const prevIcon = document.getElementById("prevPage");
  const nextIcon = document.getElementById("nextPage");

  // Update text
  pageIndicator.textContent = `Page ${currentPage} / ${totalPages}`;

  // Disable/Enable Prev
  if (currentPage === 1) {
    prevIcon.classList.add("disabled");
  } else {
    prevIcon.classList.remove("disabled");
  }

  // Disable/Enable Next
  if (currentPage === totalPages) {
    nextIcon.classList.add("disabled");
  } else {
    nextIcon.classList.remove("disabled");
  }

  // Event listeners
  prevIcon.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  };

  nextIcon.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  };
}


function setupRowInteractions() {
  // View buttons
  document.querySelectorAll(".viewBtn").forEach(button => {
    button.addEventListener("click", () => {
      const penguinId = button.dataset.id;
      showPenguinDetails(penguinId);
    });
  });

  // Delete buttons
  document.querySelectorAll(".deleteBtn").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (confirm("Are you sure you want to delete this penguin?")) {
        fetch(`https://penguin-monitoring-backend.onrender.com/penguin/${id}`, {
          method: "DELETE"
        })
          .then(res => {
            if (res.ok) {
              alert("Penguin deleted.");
              loadPenguins(true);
            } else {
              alert("Failed to delete penguin.");
            }
          })
          .catch(err => {
            console.error(err);
            alert("Error deleting penguin.");
          });
      }
    });
  });

  // Status dropdowns
  document.querySelectorAll(".statusDropdown").forEach(dropdown => {
    dropdown.addEventListener("change", function () {
      const penguinId = this.dataset.id;
      const newStatus = this.value;

      fetch(`https://penguin-monitoring-backend.onrender.com
/penguin/${penguinId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })
        .then(res => {
          if (res.ok) {
            console.log(`Status updated to ${newStatus}`);
            loadPenguins(true);
          } else {
            alert("Failed to update status.");
          }
        })
        .catch(err => {
          console.error(err);
          alert("Error updating status.");
        });
    });
  });
}
document.getElementById("searchInput").addEventListener("input", function () {
  const query = this.value.trim().toLowerCase();
  const rows = document.querySelectorAll("#penguinTable tbody tr");

  rows.forEach(row => {
    const rfid = row.children[0].textContent.toLowerCase();
    row.style.display = rfid.includes(query) ? "" : "none";
  });
});

// Add event listener to toggle button
document.getElementById('themeToggle').addEventListener('click', toggleTheme);

// Update icon based on current theme
function updateThemeIcon() {
  const icon = document.querySelector('#themeToggle i');
  if (document.body.classList.contains('light-mode')) {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  } else {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }
}

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
  
  // Update all charts when theme changes
  updateChartThemes();
}

function updateChartThemes() {
  // Update latest penguin chart if it exists
  if (window.latestPenguinChartInstance) {
    const chart = window.latestPenguinChartInstance;
    const isLightMode = document.body.classList.contains('light-mode');
    
    // Update chart options
    chart.options.scales.x.ticks.color = isLightMode ? '#333333' : '#ffffff';
    chart.options.scales.x.title.color = isLightMode ? '#333333' : '#ffffff';
    chart.options.scales.x.grid.color = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    chart.options.scales.y.ticks.color = isLightMode ? '#333333' : '#ffffff';
    chart.options.scales.y.title.color = isLightMode ? '#333333' : '#ffffff';
    chart.options.scales.y.grid.color = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    
    // Update dataset colors
    chart.data.datasets.forEach(dataset => {
      dataset.borderColor = isLightMode ? '#0369a1' : '#0284c7';
      dataset.backgroundColor = isLightMode ? 'rgba(3, 105, 161, 0.1)' : 'rgba(2, 132, 199, 0.1)';
    });
    
    chart.update();
  }
  
  // Update penguin detail chart if it exists and is visible
  if (window.weightChartInstance && !document.getElementById('modal').classList.contains('hidden')) {
    const chart = window.weightChartInstance;
    const isLightMode = document.body.classList.contains('light-mode');
    
    // Update chart options
    chart.options.scales.x.ticks.color = isLightMode ? '#333333' : '#ffffff';
    chart.options.scales.x.title.color = isLightMode ? '#333333' : '#ffffff';
    chart.options.scales.x.grid.color = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    chart.options.scales.y.ticks.color = isLightMode ? '#333333' : '#ffffff';
    chart.options.scales.y.title.color = isLightMode ? '#333333' : '#ffffff';
    chart.options.scales.y.grid.color = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    
    // Update dataset colors
    chart.data.datasets.forEach(dataset => {
      dataset.borderColor = isLightMode ? '#0369a1' : '#0077b6';
      dataset.backgroundColor = isLightMode ? 'rgba(3, 105, 161, 0.1)' : 'rgba(0, 119, 182, 0.1)';
    });
    
    chart.update();
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
  
  // Initialize charts with correct theme
  updateChartThemes();
}

document.addEventListener('DOMContentLoaded', checkSavedTheme);

function loadPenguinNotes(penguinId) {
  const container = document.getElementById("penguin-notes-section");
  container.innerHTML = "<p>Loading notes...</p>";

  fetch(`https://penguin-monitoring-backend.onrender.com/penguin/${penguinId}/notes`)
    .then(res => res.json())
    .then(notes => {
      if (notes.length === 0) {
        container.innerHTML = "<p style='opacity: 0.7;'>No notes available.</p>";
      } else {
        container.innerHTML = notes.map(n => `
          <div class="penguin-note">
            <p>${n.note}</p>
            <small style="opacity: 0.7;">${new Date(n.created_at).toLocaleString()}</small>
          </div>
        `).join("\n");
      }
    })
    .catch(error => {
      container.innerHTML = "<p style='color: red;'>Failed to load notes.</p>";
      console.error("Error loading notes:", error);
    });
}

function submitPenguinNote() {
  const input = document.getElementById("penguin-note-input")
  const note = input.value.trim()
  if (!note) return

  console.log("Submitting note for penguinId:", currentNotesPenguinId) // Debug line

  fetch(`https://penguin-monitoring-backend.onrender.com/penguin/${currentNotesPenguinId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  })
    .then(() => {
      input.value = ""
      loadPenguinNotes(currentNotesPenguinId)
    })
    .catch((err) => {
      console.error("Error submitting note:", err)
      alert("Failed to submit note")
    })
}

function toggleNotes() {
  const wrapper = document.getElementById("penguin-notes-wrapper")
  const icon = document.getElementById("notesIcon")
  const isVisible = wrapper.style.display === "block"

  wrapper.style.display = isVisible ? "none" : "block"
  icon.classList.toggle("fa-plus-square", isVisible)
  icon.classList.toggle("fa-minus-square", !isVisible)

  // Load notes when expanding
  if (!isVisible && currentNotesPenguinId) {
    loadPenguinNotes(currentNotesPenguinId)
  }
}

function toggleNotes() {
  const wrapper = document.getElementById("penguin-notes-wrapper");
  const icon = document.getElementById("notesIcon");
  const isVisible = wrapper.style.display === "block";

  wrapper.style.display = isVisible ? "none" : "block";
  icon.classList.toggle("fa-plus-square", isVisible);
  icon.classList.toggle("fa-minus-square", !isVisible);

  // Load notes when expanding
  if (!isVisible && currentNotesPenguinId) {
    loadPenguinNotes(currentNotesPenguinId);
  }
}
// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
        
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              showUpdateAvailable();
            }
          });
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        showFeedback('App updated! Refresh to see changes.', 'success');
      }
    });
  });
}

// PWA Install Prompt Handling
let deferredPrompt;
let installButton;

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('beforeinstallprompt event fired');
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  

  showInstallPromotion();
});

function showInstallPromotion() {
  // Remove existing install button if any
  if (installButton) {
    installButton.remove();
  }

  // Create install button
  installButton = document.createElement('button');
  installButton.textContent = '📱 Install App';
  installButton.className = 'install-btn';
  installButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 25px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
    animation: pulse 2s infinite;
  `;

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    .install-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(style);

  installButton.addEventListener('click', installApp);
  document.body.appendChild(installButton);

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (installButton && installButton.parentNode) {
      installButton.style.animation = 'none';
      installButton.style.opacity = '0.7';
    }
  }, 10000);
}

function installApp() {
  if (!deferredPrompt) {
    console.log('No deferred prompt available');
    return;
  }

  // Hide the button
  installButton.style.display = 'none';
  
  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
      showFeedback('App is being installed!', 'success');
    } else {
      console.log('User dismissed the install prompt');
     
    }
    deferredPrompt = null;
  });
}

// Handle app installation
window.addEventListener('appinstalled', (event) => {
  console.log('App was installed');
  showFeedback('App installed successfully!', 'success');
  if (installButton) {
    installButton.remove();
  }
});

// Offline/Online Status Detection
function initializeOfflineDetection() {
  let offlineMessage;

  function createOfflineMessage() {
    offlineMessage = document.createElement('div');
    offlineMessage.id = 'offline-message';
    offlineMessage.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ff6b6b, #ee5a24);
      color: white;
      padding: 10px 20px;
      text-align: center;
      z-index: 10000;
      transform: translateY(-100%);
      transition: transform 0.3s ease;
      font-weight: 600;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    offlineMessage.innerHTML = `
      <span> offline - Showing cached content</span>
    `;
    document.body.appendChild(offlineMessage);
  }

  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    
    if (!offlineMessage) {
      createOfflineMessage();
    }

    if (isOnline) {
      offlineMessage.style.transform = 'translateY(-100%)';
      console.log('App is online');
      // Optionally refresh data when coming back online
      refreshDataWhenOnline();
    } else {
      offlineMessage.style.transform = 'translateY(0)';
      console.log('App is offline');
    }
  }

  function refreshDataWhenOnline() {
    // Add any data refresh logic here
    if (typeof loadPenguinData === 'function') {
      loadPenguinData();
    }
  }

  // Event listeners
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Initial check
  updateOnlineStatus();
}

// Update Available Notification
function showUpdateAvailable() {
  const updateBanner = document.createElement('div');
  updateBanner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    z-index: 10001;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  `;
  updateBanner.innerHTML = `
    <div> New version available!</div>
    <small>Click to update</small>
  `;
  
  updateBanner.addEventListener('click', () => {
    window.location.reload();
  });
  
  document.body.appendChild(updateBanner);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (updateBanner.parentNode) {
      updateBanner.remove();
    }
  }, 10000);
}

// Feedback System
function showFeedback(message, type = 'info') {
  const feedback = document.createElement('div');
  const colors = {
    success: '#4CAF50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196F3'
  };
  
  feedback.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${colors[type]};
    color: white;
    padding: 12px 24px;
    border-radius: 5px;
    z-index: 10000;
    font-weight: 500;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    animation: slideUp 0.3s ease;
  `;
  
  // Add animation CSS
  if (!document.querySelector('#feedback-animations')) {
    const style = document.createElement('style');
    style.id = 'feedback-animations';
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  feedback.textContent = message;
  document.body.appendChild(feedback);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translateX(-50%) translateY(100%)';
      setTimeout(() => feedback.remove(), 300);
    }
  }, 5000);
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeOfflineDetection();
  
  // Force update check every 30 minutes
  setInterval(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({type: 'CACHE_UPDATE'});
    }
  }, 30 * 60 * 1000);
});

// Network request wrapper with offline handling
function fetchWithOfflineSupport(url, options = {}) {
  return fetch(url, options)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    })
    .catch(error => {
      if (!navigator.onLine) {
        console.log('Request failed - offline mode');
        // Return cached data or show offline message
        throw new Error('Offline - using cached data');
      }
      throw error;
    });
}

// Export for use in other scripts
window.showFeedback = showFeedback;
window.fetchWithOfflineSupport = fetchWithOfflineSupport;
// Offline/Online detection
function setupConnectionMonitor() {
  const offlineBanner = document.getElementById('offlineBanner');
  const onlineBanner = document.getElementById('onlineBanner');
  
  // Initial check
  updateStatus();
  
  // Event listeners
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  
  function updateStatus() {
    if (!navigator.onLine) {
      showOfflineBanner();
    } else {
      showOnlineBanner();
    }
  }
  
  function showOfflineBanner() {
    offlineBanner.classList.add('show');
    setTimeout(() => {
      offlineBanner.classList.remove('show');
    }, 5000); // Hide after 5 seconds
  }
  
  function showOnlineBanner() {
    // Only show if we were previously offline
    if (offlineBanner.classList.contains('show')) {
      onlineBanner.classList.add('show');
      setTimeout(() => {
        onlineBanner.classList.remove('show');
      }, 3000); // Hide after 3 seconds
    }
  }
  
 
  setInterval(() => {
    updateStatus();
  }, 30000); // Check every 30 seconds
}


document.addEventListener('DOMContentLoaded', setupConnectionMonitor);
