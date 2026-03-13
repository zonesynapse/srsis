import math

def calculate_bearing(lat1, lon1, lat2, lon2):
    """
    Calculates the bearing between two points.
    """
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    initial_bearing = math.atan2(y, x)
    initial_bearing = math.degrees(initial_bearing)
    return (initial_bearing + 360) % 360

def calculate_angle_diff(bearing1, bearing2):
    """
    Calculates the absolute difference between two bearings (0-180 degrees).
    Represents the 'sharpness' of the turn.
    """
    diff = abs(bearing1 - bearing2)
    if diff > 180:
        diff = 360 - diff
    return diff

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculates distance in meters between two points.
    """
    R = 6371000  # Radius of Earth in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
