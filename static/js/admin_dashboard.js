// admin_dashboard.js - Leaflet

document.addEventListener("DOMContentLoaded", () => {
    fetchStats();
    initAdminMap();
});

async function fetchStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();

        const listContainer = document.getElementById("risk-list");
        listContainer.innerHTML = '';

        // Update Dashboard Cards
        document.getElementById("total-routes-analyzed").textContent = data.total_routes_analyzed.toLocaleString();
        document.getElementById("high-risk-segments").textContent = data.high_risk_zones_identified.toLocaleString();
        // For avg-risk-score and active-sessions, using static data in HTML for now as API doesn't provide
        // document.getElementById("avg-risk-score").textContent = (data.avg_risk_score || 0).toFixed(2);
        // document.getElementById("active-sessions").textContent = data.active_sessions || 0;

        data.top_risky_segments.forEach((seg, idx) => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>#${idx + 1} ${seg.location}</strong> - Risk Score: <span class="${seg.score > 0.7 ? 'text-red-400' : 'text-yellow-400'}">${seg.score}</span>`;
            listContainer.appendChild(li);
        });

    } catch (e) {
        console.error("Failed to fetch admin stats", e);
    }
}

function initAdminMap() {
    const map = L.map('admin-map').setView([11.1271, 78.6569], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    // Add dummy High Risk Zones (Tamil Nadu locations)
    const risks = [
        [13.0827, 80.2707], // Chennai
        [9.9252, 78.1198],  // Madurai
        [11.0168, 76.9558]  // Coimbatore
    ];

    risks.forEach(loc => {
        L.circle(loc, {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: 500
        }).addTo(map);
    });
}
