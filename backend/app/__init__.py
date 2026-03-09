from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.routing import Rule
from app.config import Config
import os

db = SQLAlchemy()
jwt = JWTManager()


class FlexRule(Rule):
    def __init__(self, string, **kwargs):
        kwargs["strict_slashes"] = False
        super().__init__(string, **kwargs)


def _column_exists(table_name, column_name):
    rows = db.session.execute(db.text(f"PRAGMA table_info({table_name})")).fetchall()
    return any(r[1] == column_name for r in rows)


def _ensure_schema_updates():
    # Lightweight runtime schema updates for SQLite without migrations.
    schema_updates = {
        "employees": [
            ("swift", "VARCHAR(100)"),
        ],
        "invoices": [
            ("base_salary", "FLOAT"),
            ("bonus", "FLOAT"),
            ("tax_reimbursement", "FLOAT"),
        ],
        "invoice_templates": [
            ("template_pdf_path", "VARCHAR(500)"),
        ],
        "payroll_lines": [
            ("tax_reimbursement_type", "VARCHAR(20)"),
            ("tax_reimbursement_percent", "FLOAT DEFAULT 0"),
            ("tax_reimbursement_fixed", "FLOAT DEFAULT 0"),
            ("tax_reimbursement_amount", "FLOAT DEFAULT 0"),
            ("tax_reimbursement_comment", "TEXT"),
        ],
        "payments": [
            ("swift", "VARCHAR(100)"),
        ],
    }

    for table_name, columns in schema_updates.items():
        for col_name, col_type in columns:
            if not _column_exists(table_name, col_name):
                db.session.execute(
                    db.text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
                )
    db.session.commit()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.url_rule_class = FlexRule

    os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.routes.auth import auth_bp
    from app.routes.employees import employees_bp
    from app.routes.payroll import payroll_bp
    from app.routes.payments import payments_bp
    from app.routes.invoices import invoices_bp
    from app.routes.reports import reports_bp
    from app.routes.settings import settings_bp
    from app.routes.requests import requests_bp
    from app.routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(employees_bp, url_prefix="/api/employees")
    app.register_blueprint(payroll_bp, url_prefix="/api/payroll")
    app.register_blueprint(payments_bp, url_prefix="/api/payments")
    app.register_blueprint(invoices_bp, url_prefix="/api/invoices")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(settings_bp, url_prefix="/api/settings")
    app.register_blueprint(requests_bp, url_prefix="/api/requests")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    with app.app_context():
        db.create_all()
        _ensure_schema_updates()
        from app.seed import seed_data
        seed_data()

    return app
