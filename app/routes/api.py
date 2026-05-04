from flask import Blueprint, request, jsonify
from app.services.nominatim_service import NominatimService
from app.services.osrm_service import OsrmService
from app.services.risk_engine import RiskEngine

bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/get_safe_route', methods=['POST'])
def get_safe_route():
    try:
        data = request.get_json()
        origin_query = data.get('source')
        dest_query = data.get('destination')
        exclude_list = data.get('exclude', [])
        
        mode = data.get('mode', 'driving')
        
        if not origin_query or not dest_query:
            return jsonify({'error': 'Source and destination are required'}), 400
            
        # 1. Handle coordinates or Geocode Source
        # Check if origin is a coordinate pair (lat,lng)
        if ',' in origin_query and any(c.isdigit() for c in origin_query):
            try:
                lat, lng = map(float, origin_query.split(','))
                start_coords = {'lat': lat, 'lng': lng}
            except (ValueError, IndexError):
                start_coords = NominatimService.get_coordinates(origin_query)
        else:
            start_coords = NominatimService.get_coordinates(origin_query)
            
        if not start_coords:
            return jsonify({'error': f"Could not find location: '{origin_query}'"}), 404
            
        end_coords = NominatimService.get_coordinates(dest_query)
        if not end_coords:
            return jsonify({'error': f"Could not find location: '{dest_query}'"}), 404

        # 2. Fetch Routes from OSRM
        osrm_routes = OsrmService.get_route(start_coords, end_coords, exclude=exclude_list, mode=mode)
        
        if isinstance(osrm_routes, dict) and 'error' in osrm_routes:
             return jsonify(osrm_routes), 500
             
        # 3. Normalize Data (Convert OSRM format -> App Internal format)
        routes = OsrmService.normalize_for_frontend(osrm_routes, mode=mode)
        
        # 4. Analyze Risk
        analyzed_routes = RiskEngine.process_route_data(routes)
        
        # 5. Sort/Rank
        # Fastest: Sort by duration value
        fastest = sorted(analyzed_routes, key=lambda x: x['duration_val'])[0]
        # Safest: Sort by risk_stats.avg_score
        safest = sorted(analyzed_routes, key=lambda x: x['risk_stats']['avg_score'])[0]
        
        return jsonify({
            'routes': analyzed_routes,
            'recommendations': {
                'fastest_idx': analyzed_routes.index(fastest),
                'safest_idx': analyzed_routes.index(safest)
            },
            'waypoints': {
                'start': start_coords,
                'end': end_coords
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc() # Print to server console
        return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500

@bp.route('/admin/stats', methods=['GET'])
def admin_stats():
    # Mock admin stats
    return jsonify({
        'total_routes_analyzed': 124,
        'high_risk_zones_identified': 45,
        'top_risky_segments': [
            {'location': 'Route 66 - Bend 4', 'score': 0.95},
            {'location': 'Downtown Crossing', 'score': 0.88}
        ]
    })
