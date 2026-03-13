from flask import Flask
from config import Config

def create_app(config_class=Config):
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    app.config.from_object(config_class)

    # Register Blueprints
    from app.routes.main import bp as main_bp
    app.register_blueprint(main_bp)
    
    from app.routes.api import bp as api_bp
    app.register_blueprint(api_bp)

    @app.context_processor
    def inject_api_key():
        return {'GOOGLE_MAPS_API_KEY': app.config['GOOGLE_MAPS_API_KEY']}

    return app
