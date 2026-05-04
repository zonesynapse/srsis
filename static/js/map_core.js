// map_core.js - Leaflet Integration

let map;
let routeLayers = []; // Store polyline layers
let userMarker;
let startMarker, endMarker;
window.isUserInteracting = false;
let liveCoords = null; // Store {lat, lng} for live location
let currentRiskSegments = null; // Store fetched segments for manual simulation start

// Toast Notification Helper
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 150px;
        right: 20px;
        padding: 16px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    if (!document.getElementById('toast-animation')) {
        style.id = 'toast-animation';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

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
    map.on('mousedown touchstart', () => { window.isUserInteracting = true; });
    map.on('mouseup touchend', () => { setTimeout(() => { window.isUserInteracting = false; }, 3000); }); // Wait 3s before auto-panning again

    // Live Location Logic
    const getLocBtn = document.getElementById("get-location-btn");
    const sourceInput = document.getElementById("source");

    if (getLocBtn) {
        getLocBtn.addEventListener("click", () => {
            if (!navigator.geolocation) return alert("Geolocation is not supported by your browser");

            getLocBtn.querySelector('i').classList.add('animate-spin');
            
            navigator.geolocation.getCurrentPosition((pos) => {
                const { latitude, longitude } = pos.coords;
                liveCoords = { lat: latitude, lng: longitude };
                sourceInput.value = "My Current Location";
                
                // Pan map to user and show marker
                map.setView([latitude, longitude], 15);
                if (userMarker) {
                    userMarker.setLatLng([latitude, longitude]).addTo(map);
                }

                getLocBtn.querySelector('i').classList.remove('animate-spin');
                getLocBtn.classList.add('text-emerald-500');
                if (window.lucide) lucide.createIcons();
                showToast("📍 Location found", "success");
            }, (err) => {
                getLocBtn.querySelector('i').classList.remove('animate-spin');
                
                let msg = "Could not get location";
                if (err.code === 1) {
                    msg = "Location permission denied. Please enable GPS.";
                } else if (err.code === 2) {
                    msg = "Location unavailable. Check your network.";
                } else if (err.code === 3) {
                    msg = "Location request timed out.";
                }
                
                showToast(msg, "error");
                console.error("Geolocation Error:", err);
            }, { enableHighAccuracy: true, timeout: 10000 });
        });
    }

    // Clear live coords if user types manually
    sourceInput.addEventListener("input", () => {
        if (sourceInput.value !== "My Current Location") {
            liveCoords = null;
            if (getLocBtn) {
                getLocBtn.classList.remove('text-emerald-500');
            }
        }
    });

    document.getElementById("find-route-btn").addEventListener("click", calculateRoute);
    
    // Bind Action Buttons
    document.getElementById("start-simulation-btn").addEventListener("click", () => {
        if (currentRiskSegments) {
            const simBtn = document.getElementById("start-simulation-btn");
            simBtn.textContent = "⏱️ Simulation Running...";
            simBtn.style.opacity = "0.7";
            simBtn.disabled = true;
            
            // Start simulation with user marker
            startSimulation(currentRiskSegments, map, userMarker);
            showToast("🚗 Vehicle started navigating the route", "success", 4000);
            
            console.log("🚗 Simulation started - Vehicle is now navigating the route");
        } else {
            alert("Please analyze a route first");
        }
    });

    document.getElementById("download-report-btn").addEventListener("click", () => {
        if (!currentRiskSegments) return;
        
        let reportText = "╔════════════════════════════════════════════════════════════╗\n";
        reportText += "║     SafeRoute - Geometric Risk Intelligence Report        ║\n";
        reportText += "║               Route Safety Analysis Report                 ║\n";
        reportText += "╚════════════════════════════════════════════════════════════╝\n\n";
        
        reportText += "📊 RISK SUMMARY\n";
        reportText += "═".repeat(60) + "\n";
        let highRisk = currentRiskSegments.filter(s => s.risk_level === 'HIGH').length;
        let medRisk = currentRiskSegments.filter(s => s.risk_level === 'MEDIUM').length;
        let lowRisk = currentRiskSegments.filter(s => s.risk_level === 'LOW').length;
        
        reportText += `Total Segments Analyzed: ${currentRiskSegments.length}\n`;
        reportText += `  🔴 High Risk Zones: ${highRisk}\n`;
        reportText += `  🟠 Medium Risk Zones: ${medRisk}\n`;
        reportText += `  🟢 Low Risk Zones: ${lowRisk}\n\n`;
        
        reportText += "⚠️  DANGEROUS SEGMENTS BREAKDOWN\n";
        reportText += "═".repeat(60) + "\n";
        let dangerousCount = 0;
        currentRiskSegments.forEach((seg, i) => {
            if(seg.risk_level === 'HIGH' || seg.risk_level === 'MEDIUM') {
                dangerousCount++;
                reportText += `\n${dangerousCount}. [${seg.risk_level}] Segment ${i}\n`;
                reportText += `   Risk Score: ${seg.risk_score} / 1.0\n`;
                reportText += `   Curve Severity: ${seg.details.curve_severity}\n`;
                reportText += `   Turn Angle: ${seg.details.angle}°\n`;
                reportText += `   Weather: ${seg.details.weather}\n`;
                reportText += `   Traffic Impact: ${(seg.details.traffic_impact * 100).toFixed(0)}%\n`;
            }
        });
        
        reportText += "\n" + "═".repeat(60) + "\n";
        reportText += "Generated: " + new Date().toLocaleString() + "\n";
        reportText += "System: SafeRoute Risk Intelligence\n";

        const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SafeRoute_Risk_Report_${new Date().getTime()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        showToast("📄 Risk report downloaded successfully", "success", 3000);
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

    // Use coordinates if live location is active, otherwise use the string
    let sourcePayload = source;
    if (source === "My Current Location" && liveCoords) {
        sourcePayload = `${liveCoords.lat},${liveCoords.lng}`;
    }

    try {
        const response = await fetch('/api/get_safe_route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: sourcePayload,
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
        simBtn.disabled = false;
        
        // Enable download button
        const dlBtn = document.getElementById("download-report-btn");
        dlBtn.disabled = false;
        
        // Show route stats
        document.getElementById("route-stats").classList.remove("hidden");

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

    const fastest = [...routes].sort((a, b) => a.duration_val - b.duration_val)[0];
    const safest = [...routes].sort((a, b) => a.risk_stats.avg_score - b.risk_stats.avg_score)[0];

    document.getElementById("safe-time").textContent = safest.duration;
    document.getElementById("safe-risk").textContent = `Score: ${safest.risk_stats.avg_score}`;

    document.getElementById("fast-time").textContent = fastest.duration;
    document.getElementById("fast-risk").textContent = `Score: ${fastest.risk_stats.avg_score}`;
}
