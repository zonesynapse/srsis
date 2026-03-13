// alert_system.js - Leaflet Compatible

window.simulationInterval = null;
let activeAlertTimer = null; // Prevent flickering
let lastSpokenZone = null; // Prevent repeating voice alerts for the same zone
let currentRotation = 0; // Track cumulative rotation for shortest path animation

function startSimulation(riskSegments, mapInstance, markerInstance) {
    if (window.simulationInterval) clearInterval(window.simulationInterval);
    if (!mapInstance) return;

    // Monitor both HIGH and MEDIUM risk zones, attach their original index so we know if they are ahead or behind
    const alertZones = riskSegments.map((s, idx) => ({ ...s, original_index: idx }))
                                   .filter(s => s.risk_level === 'HIGH' || s.risk_level === 'MEDIUM');
    let currentSegmentIdx = 0;

    // Add user marker if not on map
    if (!mapInstance.hasLayer(markerInstance)) {
        markerInstance.addTo(mapInstance);
    }

    window.simulationInterval = setInterval(() => {
        if (currentSegmentIdx >= riskSegments.length) {
            clearInterval(window.simulationInterval);
            return;
        }

        const seg = riskSegments[currentSegmentIdx];
        const nextSeg = riskSegments[currentSegmentIdx + 1];
        const currentPos = seg.start_point; // [lat, lng]

        markerInstance.setLatLng(currentPos);

        // Calculate Rotation with Jitter Protection
        if (nextSeg) {
            const nextPos = nextSeg.start_point;
            const distToNext = L.latLng(currentPos).distanceTo(L.latLng(nextPos));
            
            // Only rotate if we've moved significantly (prevents spinning on tiny segments)
            if (distToNext > 5) { 
                const targetBearing = calculateBearing(currentPos[0], currentPos[1], nextPos[0], nextPos[1]);
                const arrow = document.getElementById('navigator-arrow');
                
                if (arrow) {
                    // Shortest path rotation logic
                    let diff = targetBearing - (currentRotation % 360);
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    
                    currentRotation += diff;
                    arrow.style.transform = `rotate(${currentRotation}deg)`;
                }
            }
        }

        // Optional: Pan map to follow car ONLY if user isn't trying to zoom/drag
        if (typeof isUserInteracting !== 'undefined' && !isUserInteracting) {
            mapInstance.panTo(currentPos);
        }

        checkRiskProximity(currentPos, alertZones, currentSegmentIdx);

        currentSegmentIdx++;
    }, 2000); // 2 seconds per jump
}

function checkRiskProximity(userPos, alertZones, currentIdx) {
    const ALERT_THRESHOLD_METERS = 2500; // Increased distance to 2.5km for better demo visibility

    let nearestRiskDist = Infinity;
    let closestZoneLevel = null;

    // Convert array [lat, lng] to Leaflet LatLng object
    const userLatLng = L.latLng(userPos[0], userPos[1]);

    alertZones.forEach(zone => {
        // Only care about risk zones that are AHEAD of our current position
        if (zone.original_index < currentIdx) return;
        
        const zoneLatLng = L.latLng(zone.start_point[0], zone.start_point[1]);
        const dist = userLatLng.distanceTo(zoneLatLng);

        if (dist < nearestRiskDist) {
            nearestRiskDist = dist;
            closestZoneLevel = zone.risk_level;
        }
    });

    const alertBox = document.getElementById("risk-alert");

    if (nearestRiskDist <= ALERT_THRESHOLD_METERS && closestZoneLevel) {
        alertBox.classList.remove("hidden");
        const distText = nearestRiskDist < 1000 ? `${Math.round(nearestRiskDist)}m` : `${(nearestRiskDist / 1000).toFixed(1)}km`;
        alertBox.querySelector("h4").textContent = `${closestZoneLevel} Risk Zone Ahead`;
        alertBox.querySelector("p").textContent = `Approaching in ${distText}. Please be careful.`;
        
        if (closestZoneLevel === 'HIGH') {
            alertBox.style.background = 'rgba(239, 68, 68, 0.9)'; // Red for HIGH
        } else if (closestZoneLevel === 'MEDIUM') {
            alertBox.style.background = 'rgba(245, 158, 11, 0.9)'; // Orange for MEDIUM
        }

        // Voice Alert (New Feature)
        if (lastSpokenZone !== closestZoneLevel && nearestRiskDist < 1000) {
            speakAlert(`${closestZoneLevel} risk zone detected. Drive carefully.`);
            lastSpokenZone = closestZoneLevel;
        }

        // Reset the hide timer every time we are near a zone
        if (activeAlertTimer) clearTimeout(activeAlertTimer);
        
        // Keep alert visible for 4s after leaving zone to prevent flickering
        activeAlertTimer = setTimeout(() => {
            alertBox.classList.add("hidden");
        }, 4000);
        
    } else {
        // Only hide if the timer isn't keeping it alive
        if (!activeAlertTimer) {
            alertBox.classList.add("hidden");
            lastSpokenZone = null; // Reset so it can speak for the next zone
        }
    }
}

// AI Voice Guidance
function speakAlert(message) {
    if ('speechSynthesis' in window) {
        // Cancel previous speech if overlap
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// Helper to calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => deg * (Math.PI / 180);
    const toDeg = (rad) => rad * (180 / Math.PI);

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const lam1 = toRad(lon1);
    const lam2 = toRad(lon2);

    const y = Math.sin(lam2 - lam1) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);
    
    let bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
}
