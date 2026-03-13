// map_core.js - Leaflet Integration

let map;
let routeLayers = []; // Store polyline layers
let userMarker;
let startMarker, endMarker;
let isUserInteracting = false;
let currentRiskSegments = null; // Store fetched segments for manual simulation start

// Initialize Map
// Initialize Map
document.addEventListener('DOMContentLoaded', () => {
    // Default: Tamil Nadu
    map = L.map('map').setView([11.1271, 78.6569], 7);

    // 1. OpenStreetMap (Standard) - BEST for Overlay Alignment
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    });

    // 2. Google Maps Tiles
    const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    });

    const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    });

    const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    });

    // Default to OpenStreetMap to ensure polyline matches road perfectly
    osm.addTo(map);

    // Add Layer Control
    L.control.layers({
        "Standard (OSM)": osm,
        "Google Streets": googleStreets,
        "Google Satellite": googleSat,
        "Hybrid": googleHybrid
    }).addTo(map);

    // ... (rest of controls)
    L.control.scale().addTo(map);

    // Mode Selection Logic
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all
            modeBtns.forEach(b => {
                b.classList.remove('bg-blue-600');
                b.classList.add('bg-gray-700');
            });
            // Add to clicked
            const target = e.currentTarget; // Handle icon click inside button
            target.classList.remove('bg-gray-700');
            target.classList.add('bg-blue-600');
            target.classList.add('active');
        });
    });

    // Track User Interaction to stop annoying auto-panning during zoom/drag
    map.on('mousedown touchstart', () => { isUserInteracting = true; });
    map.on('mouseup touchend', () => { setTimeout(() => { isUserInteracting = false; }, 3000); }); // Wait 3s before auto-panning again

    document.getElementById("find-route-btn").addEventListener("click", calculateRoute);
    
    // Bind Action Buttons
    document.getElementById("start-simulation-btn").addEventListener("click", () => {
        if (currentRiskSegments) {
            startSimulation(currentRiskSegments, map, userMarker);
            document.getElementById("start-simulation-btn").textContent = "Simulation Running...";
            document.getElementById("start-simulation-btn").style.opacity = "0.7";
        }
    });

    document.getElementById("download-report-btn").addEventListener("click", () => {
        if (!currentRiskSegments) return;
        
        let reportText = "SafeRoute - Geometric Risk Intelligence Report\n";
        reportText += "==============================================\n\n";
        let highRisk = currentRiskSegments.filter(s => s.risk_level === 'HIGH').length;
        let medRisk = currentRiskSegments.filter(s => s.risk_level === 'MEDIUM').length;
        
        reportText += `Total High Risk Zones: ${highRisk}\n`;
        reportText += `Total Medium Risk Zones: ${medRisk}\n\n`;
        
        reportText += "Detailed Breakdown (Dangerous Segments Only):\n";
        currentRiskSegments.forEach((seg, i) => {
            if(seg.risk_level === 'HIGH' || seg.risk_level === 'MEDIUM') {
                reportText += `- Segment ${i}: ${seg.risk_level} Risk (Score: ${seg.risk_score})\n`;
                reportText += `  Curve Severity: ${seg.details.curve_severity}, Traffic Impact: ${seg.details.traffic_impact}\n\n`;
            }
        });

        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SafeRoute_Risk_Report.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    });
    // ... rest of init
    // Init simulated user marker (Navigator Arrow)
    const carIcon = L.divIcon({
        className: 'navigator-icon',
        html: `
            <div id="navigator-arrow" style="
                width: 30px; 
                height: 30px; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                transition: transform 0.5s ease;
            ">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#3b82f6" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                </svg>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    userMarker = L.marker([0, 0], { 
        icon: carIcon, 
        zIndexOffset: 1000, 
        interactive: false 
    });
});

async function calculateRoute() {
    const source = document.getElementById("source").value;
    const dest = document.getElementById("destination").value;

    if (!source || !dest) return alert("Please enter source and destination");

    try {
        const response = await fetch('/api/get_safe_route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: source,
                destination: dest,
                exclude: [],
                mode: 'driving'
            })
        });

        const data = await response.json();

        if (data.error) {
            alert("Error: " + (data.message || data.error));
            return;
        }

        // 1. Draw Safest Route
        const safestIdx = data.recommendations.safest_idx;
        const safestRoute = data.routes[safestIdx];

        renderRoute(safestRoute, data.waypoints);
        updateStats(data.routes);
        
        // Save for manual simulation start
        currentRiskSegments = safestRoute.risk_segments;
        
        // Reset simulation button
        const simBtn = document.getElementById("start-simulation-btn");
        simBtn.textContent = "Start Simulation";
        simBtn.style.opacity = "1";
        
        // Show action buttons
        document.getElementById("action-buttons").style.display = "flex";

    } catch (e) {
        console.error("Route Error:", e);
        alert("Failed to fetch route analysis.\nDetails: " + e.message);
    }
}

function renderRoute(routeData, waypoints) {
    // Clear old layers
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = [];
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);

    // Draw full path in background (Google Blue)
    const latLngs = routeData.original_route_data.overview_polyline.points;

    // Base Blue Line (Navigation Path)
    const baseLine = L.polyline(latLngs, {
        color: '#4285F4', // Google Blue
        weight: 6,
        opacity: 0.8,
        smoothFactor: 0 // Prevent simplification so segments match perfectly
    }).addTo(map);
    routeLayers.push(baseLine);

    // Fit bounds
    map.fitBounds(baseLine.getBounds(), { padding: [50, 50] });

    // Add Start/End Markers snapped perfectly to the drawn route line
    if (latLngs && latLngs.length > 0) {
        const routeStart = latLngs[0];
        const routeEnd = latLngs[latLngs.length - 1];
        
        // Custom Start Icon (Green Circle with Dot)
        const startIcon = L.divIcon({
            className: 'custom-start-icon',
            html: `
                <div style='
                    background-color: #10b981; 
                    width: 24px; 
                    height: 24px; 
                    border-radius: 50%; 
                    border: 3px solid white; 
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                '>
                    <div style='background: white; width: 8px; height: 8px; border-radius: 50%;'></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });

        // Custom Destination Icon (Red Pin)
        const destIcon = L.divIcon({
            className: 'custom-dest-icon',
            html: `
                <div style='
                    background-color: #ef4444; 
                    width: 28px; 
                    height: 28px; 
                    border-radius: 50% 50% 50% 0; 
                    border: 3px solid white; 
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    transform: rotate(-45deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                '>
                    <div style='background: white; width: 10px; height: 10px; border-radius: 50%;'></div>
                </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 28], // Anchor at bottom tip
            popupAnchor: [0, -28]
        });

        startMarker = L.marker(routeStart, {icon: startIcon}).addTo(map).bindPopup("Start");
        endMarker = L.marker(routeEnd, {icon: destIcon}).addTo(map).bindPopup("Destination");
    } else if (waypoints) {
        // Fallback to geocoder if geometry is missing
        startMarker = L.marker([waypoints.start.lat, waypoints.start.lng], {icon: startIcon}).addTo(map).bindPopup("Start");
        endMarker = L.marker([waypoints.end.lat, waypoints.end.lng], {icon: destIcon}).addTo(map).bindPopup("Destination");
    }

    // Overlay Risk Segments (Red/Yellow)
    routeData.risk_segments.forEach(seg => {
        if (seg.risk_level === 'HIGH' || seg.risk_level === 'MEDIUM') {
            const points = seg.geometry || [seg.start_point, seg.start_point];

            const riskLine = L.polyline(points, {
                color: getRiskColor(seg.risk_level),
                weight: 6,
                opacity: 1.0,
                smoothFactor: 0
            }).addTo(map);

            riskLine.bindTooltip(`${seg.risk_level} Risk`, { sticky: true });
            routeLayers.push(riskLine);
        }
    });
}

function getRiskColor(level) {
    switch (level) {
        case 'HIGH': return '#ef4444';
        case 'MEDIUM': return '#f59e0b';
        case 'LOW': return '#10b981';
        default: return '#3b82f6';
    }
}

function updateStats(routes) {
    document.getElementById("route-stats").classList.remove("hidden");

    const fastest = routes.sort((a, b) => a.duration_val - b.duration_val)[0];
    const safest = routes.sort((a, b) => a.risk_stats.avg_score - b.risk_stats.avg_score)[0];

    document.getElementById("safe-time").textContent = safest.duration;
    document.getElementById("safe-risk").textContent = `Score: ${safest.risk_stats.avg_score}`;

    document.getElementById("fast-time").textContent = fastest.duration;
    document.getElementById("fast-risk").textContent = `Score: ${fastest.risk_stats.avg_score}`;
}
