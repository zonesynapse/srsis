import requests

class NominatimService:
    BASE_URL = "https://nominatim.openstreetmap.org/search"
    
    @staticmethod
    def get_coordinates(query):
        """
        Geocodes a text query (e.g., 'New York') to (lat, lon).
        """
        headers = {
            'User-Agent': 'SafeRouteApp/1.0 (Student Project)'
        }
        # Append 'India' to query to ensure local results
        if "india" not in query.lower():
            search_query = f"{query}, India"
        else:
            search_query = query

        params = {
            'q': search_query,
            'format': 'json',
            'limit': 5,
            'countrycodes': 'in' # Restrict search to India
        }
        
        try:
            response = requests.get(NominatimService.BASE_URL, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            if not data:
                return None
            
            # Prefer place over boundary/administrative to fix District vs City center issues
            selected_place = data[0]
            for item in data:
                if item.get('class') == 'place' and item.get('type') in ['city', 'town', 'village', 'island']:
                    selected_place = item
                    break
            
            # Nominatim returns string lat/lon
            return {
                'lat': float(selected_place['lat']),
                'lng': float(selected_place['lon']),
                'name': selected_place['display_name']
            }
            
        except requests.RequestException as e:
            print(f"Nominatim Error: {e}")
            return None
