import polyline
from app.utils.geometry import calculate_bearing, calculate_angle_diff, haversine_distance
from app.services.weather_service import WeatherService

class RiskEngine:
    # Weights
    W_CURVE = 0.5
    W_WEATHER = 0.3
    W_TRAFFIC = 0.2

    @staticmethod
    def analyze_route(route_polyline, traffic_factor=0.0):
        """
        Analyzes route. route_polyline can be encoded string OR list of points.
        traffic_factor is between 0.0 (no traffic) and 1.0 (heavy traffic).
        """
        if isinstance(route_polyline, str):
            points = polyline.decode(route_polyline)
        else:
            points = route_polyline # Already decoded list
            
        segments = []
        
        if len(points) < 3:
            return [] # Not enough points to analyze curves

        for i in range(len(points) - 2):
            p1 = points[i]
            p2 = points[i+1]
            p3 = points[i+2]
            
            # 1. Geometry Analysis
            bearing1 = calculate_bearing(p1[0], p1[1], p2[0], p2[1])
            bearing2 = calculate_bearing(p2[0], p2[1], p3[0], p3[1])
            angle_diff = calculate_angle_diff(bearing1, bearing2)
            
            # Normalize angle (0-180) to Score (0-1)
            # A 90 degree turn is VERY sharp. Let's say > 60 is High Risk (1.0)
            curve_severity = min(angle_diff / 60.0, 1.0)
            
            # 2. Context Analysis (Weather/Time)
            # Optimization: Don't call weather for every 10m point. 
            # Ideally fetch once per route or per large region. 
            # Here we mock it efficiently.
            weather_ctx = WeatherService.get_weather_context(p2[0], p2[1])
            weather_severity = weather_ctx['severity']
            
            # 3. Calculate Risk Score
            # Risk = (Curve * W_CURVE) + (Weather * W_WEATHER) + (Traffic * W_TRAFFIC)
            risk_score = (curve_severity * RiskEngine.W_CURVE) + \
                         (weather_severity * RiskEngine.W_WEATHER) + \
                         (traffic_factor * RiskEngine.W_TRAFFIC)
            
            # Additional Context: if traffic is severe, bad weather is even riskier.
            if traffic_factor > 0.6 and weather_severity > 0.5:
                risk_score = min(risk_score * 1.2, 1.0)
            
            # Classify
            risk_level = 'LOW'
            if risk_score > 0.7:
                risk_level = 'HIGH'
            elif risk_score > 0.4:
                risk_level = 'MEDIUM'
                
            segments.append({
                'start_point': p2,
                'geometry': [p1, p2, p3], # Full segment points for polyline drawing
                'risk_score': round(risk_score, 2),
                'risk_level': risk_level,
                'details': {
                    'angle': round(angle_diff, 1),
                    'curve_severity': round(curve_severity, 2),
                    'weather': weather_ctx['condition'],
                    'traffic_impact': round(traffic_factor, 2)
                }
            })
            
        return segments

    @staticmethod
    def process_route_data(routes_json):
        """
        Processes standard Google Directions API response and injects risk data.
        Assuming input is list of routes.
        """
        processed_routes = []
        
        for route in routes_json:
            try:
                # Calculate real-time traffic factor based on speed
                duration_sec = route['legs'][0]['duration']['value']
                distance_meters = route['legs'][0]['distance']['value']
                
                # Default traffic factor
                traffic_factor = 0.0
                if duration_sec > 0 and distance_meters > 0:
                    speed_kmh = (distance_meters / 1000.0) / (duration_sec / 3600.0)
                    # Assuming typical free-flow speed of 60 km/h for mixed routes
                    # If speed drops below 20 km/h, it's very heavy congestion
                    expected_speed = 60.0
                    if speed_kmh < expected_speed:
                        congestion_ratio = (expected_speed - speed_kmh) / expected_speed
                        traffic_factor = min(max(congestion_ratio, 0.0), 1.0)
            except (KeyError, IndexError, ZeroDivisionError):
                traffic_factor = 0.0
                
            overview_polyline = route['overview_polyline']['points']
            risk_segments = RiskEngine.analyze_route(overview_polyline, traffic_factor=traffic_factor)
            
            # Aggregate Risk for Route Comparison
            total_risk = sum(seg['risk_score'] for seg in risk_segments)
            avg_risk = total_risk / len(risk_segments) if risk_segments else 0
            
            processed_routes.append({
                'summary': route.get('summary', ''),
                'duration': route['legs'][0]['duration']['text'],
                'duration_val': route['legs'][0]['duration']['value'],
                'distance': route['legs'][0]['distance']['text'],
                'risk_stats': {
                    'total_score': round(total_risk, 1),
                    'avg_score': round(avg_risk, 2),
                    'high_risk_segments': len([s for s in risk_segments if s['risk_level'] == 'HIGH'])
                },
                'risk_segments': risk_segments, # For Frontend Visualization
                'original_route_data': route # Keep original for rendering
            })
            
        return processed_routes
