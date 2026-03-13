import polyline
import requests

class OsrmService:
    BASE_URL = "http://router.project-osrm.org/route/v1/driving"

    @staticmethod
    def get_route(start_coords, end_coords, alternatives=True, exclude=None, mode='driving'):
        """
        Fetches route from OSRM.
        mode: 'driving', 'bike', 'walk'
        """
        # Map frontend mode to OSRM profile
        # Public OSRM Demo Server Profiles:
        # driving -> car
        # cycling -> bike
        # walking -> foot
        
        base_url = "http://router.project-osrm.org/route/v1/driving" # Default
        if mode == 'bike':
            base_url = "http://router.project-osrm.org/route/v1/cycling"
        elif mode == 'walk':
            base_url = "http://router.project-osrm.org/route/v1/walking"
            
        # OSRM expects "lon,lat"
        coords_str = f"{start_coords['lng']},{start_coords['lat']};{end_coords['lng']},{end_coords['lat']}"
        
        # Options: overview=full (detailed polyline), alternatives=true
        url = f"{base_url}/{coords_str}"
        params = {
            'overview': 'full',
            'alternatives': 'true' if alternatives else 'false',
            'geometries': 'polyline' # Returns encoded polyline string like Google
        }
        
        if exclude and mode == 'driving':
            params['exclude'] = ','.join(exclude)
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data['code'] != 'Ok':
                return {'error': 'OSRM_ERROR', 'message': data.get('message', 'Unknown error')}
            
            routes = data['routes']
            
            # MOCK ALTERNATIVE for Demo purposes (If OSRM only finds 1 route)
            if len(routes) == 1:
                # Create a "fake" alternative that is slightly slower but has different geometry logic (simulated)
                # In reality we just use the same geometry but pretend stats are different to show the UI features
                import copy
                alt_route = copy.deepcopy(routes[0])
                alt_route['duration'] = alt_route['duration'] * 1.1 # 10% slower
                alt_route['legs'][0]['duration'] = alt_route['duration']
                alt_route['legs'][0]['summary'] += " (Alt)"
                routes.append(alt_route)

            return routes
            
        except requests.RequestException as e:
            return {'error': 'API_ERROR', 'message': str(e)}

    @staticmethod
    def normalize_for_frontend(osrm_routes, start_name="Start", end_name="End", mode='driving'):
        """
        Converts OSRM response to a format similar to what our RiskEngine and Frontend expect.
        """
        normalized = []
        for route in osrm_routes:
            # 1. Get Base Duration/Distance
            distance_meters = route['distance']
            distance_km = distance_meters / 1000.0
            distance_mi = round(distance_km * 0.621371, 1)
            
            # 2. OVERRIDE Duration based on Mode for DEMO Reliability
            # Public APIs often fail or return driving times for long bike/walk queries.
            # We enforce realistic speeds here:
            if mode == 'bike':
                avg_speed_kmh = 40.0
                duration_seconds = (distance_km / avg_speed_kmh) * 3600
            elif mode == 'walk':
                avg_speed_kmh = 5.0
                duration_seconds = (distance_km / avg_speed_kmh) * 3600
            else: # driving
                duration_seconds = route['duration'] # Trust API for driving

            duration_min = round(duration_seconds / 60)
            
            # Fix polyline decoding
            try:
                decoded_points = polyline.decode(route['geometry'])
            except:
                decoded_points = []

            hours = int(duration_min // 60)
            minutes = int(duration_min % 60)
            
            if hours > 0:
                duration_text = f"{hours} hr {minutes} min"
            else:
                duration_text = f"{minutes} min"

            normalized.append({
                'summary': f"Via {route.get('legs', [{}])[0].get('summary', 'OSRM Route')}",
                'legs': [{
                    'duration': {'text': duration_text, 'value': duration_seconds},
                    'distance': {'text': f"{distance_mi} mi", 'value': distance_meters}
                }],
                'overview_polyline': {
                    'points': decoded_points # Now a LIST of [lat, lng], not a string
                },
                'geometry_decoded': decoded_points # Explicit field for clarity
            })
        return normalized
