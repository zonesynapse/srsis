import random
from datetime import datetime

class WeatherService:
    @staticmethod
    def get_weather_context(lat, lng):
        """
        Simulates fetching weather data for a given location.
        Returns a dictionary with 'condition', 'code', and 'severity'.
        """
        # Mock Logic: Randomize based on "random" but deterministic for demo if needed
        # For now, purely random simulation for demo purposes as per plan
        conditions = [
            {'condition': 'Clear', 'severity': 0.0},
            {'condition': 'Rain', 'severity': 0.5},
            {'condition': 'Fog', 'severity': 0.8},
            {'condition': 'Night/Clear', 'severity': 0.3},
        ]
        
        # Simple weighted random to favor 'Clear' mostly
        weights = [0.6, 0.2, 0.1, 0.1] 
        chosen = random.choices(conditions, weights=weights, k=1)[0]
        
        # Override for "Night" based on real time if desired, but here we simulate
        current_hour = datetime.now().hour
        is_night = current_hour < 6 or current_hour > 18
        
        if is_night:
             # Increase baseline risk for night
             chosen['severity'] += 0.2
             chosen['is_night'] = True
        else:
             chosen['is_night'] = False
             
        # Cap severity at 1.0
        chosen['severity'] = min(chosen['severity'], 1.0)
        
        return chosen
