from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app import db
from app.models import Department, LegalEntity, CustomField, Currency, CryptoNetwork, CurrencyConversionConfig, ExchangeRate
from app.services.currency_conversion import fetch_rates, get_all_rates, test_connection, convert_to_usdc

settings_bp = Blueprint("settings", __name__)


DEFAULT_EMPLOYMENT_TYPES = [
    "Contractor", "Contractor via agency", "Employee via agency",
]


@settings_bp.route("/departments", methods=["GET"])
@jwt_required()
def list_departments():
    departments = Department.query.order_by(Department.name).all()
    return jsonify([d.to_dict() for d in departments])


@settings_bp.route("/departments", methods=["POST"])
@jwt_required()
def create_department():
    data = request.get_json()
    if Department.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "Department already exists"}), 400
    dept = Department(name=data["name"])
    db.session.add(dept)
    db.session.commit()
    return jsonify(dept.to_dict()), 201


@settings_bp.route("/departments/<int:id>", methods=["PUT"])
@jwt_required()
def update_department(id):
    dept = Department.query.get_or_404(id)
    data = request.get_json()
    if "name" in data:
        existing = Department.query.filter_by(name=data["name"]).first()
        if existing and existing.id != dept.id:
            return jsonify({"error": "Department name already exists"}), 400
        dept.name = data["name"]
    db.session.commit()
    return jsonify(dept.to_dict())


@settings_bp.route("/departments/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_department(id):
    dept = Department.query.get_or_404(id)
    db.session.delete(dept)
    db.session.commit()
    return jsonify({"message": "Department deleted"})


@settings_bp.route("/legal-entities", methods=["GET"])
@jwt_required()
def list_legal_entities():
    entities = LegalEntity.query.order_by(LegalEntity.name).all()
    return jsonify([e.to_dict() for e in entities])


@settings_bp.route("/legal-entities", methods=["POST"])
@jwt_required()
def create_legal_entity():
    data = request.get_json()
    if LegalEntity.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "Legal entity already exists"}), 400
    le = LegalEntity(
        name=data["name"],
        address=data.get("address"),
        registration_number=data.get("registration_number"),
    )
    db.session.add(le)
    db.session.commit()
    return jsonify(le.to_dict()), 201


@settings_bp.route("/legal-entities/<int:id>", methods=["PUT"])
@jwt_required()
def update_legal_entity(id):
    le = LegalEntity.query.get_or_404(id)
    data = request.get_json()
    for field in ("name", "address", "registration_number"):
        if field in data:
            setattr(le, field, data[field])
    db.session.commit()
    return jsonify(le.to_dict())


@settings_bp.route("/legal-entities/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_legal_entity(id):
    le = LegalEntity.query.get_or_404(id)
    db.session.delete(le)
    db.session.commit()
    return jsonify({"message": "Legal entity deleted"})


@settings_bp.route("/employment-types", methods=["GET"])
@jwt_required()
def list_employment_types():
    return jsonify([{"id": i, "name": t} for i, t in enumerate(DEFAULT_EMPLOYMENT_TYPES, 1)])


@settings_bp.route("/currencies", methods=["GET"])
@jwt_required()
def list_currencies():
    items = Currency.query.order_by(Currency.code).all()
    if not items:
        for c in ["EUR", "USD", "GBP", "PLN", "BYN", "RUB", "CHF", "USDT", "USDC"]:
            db.session.add(Currency(code=c, name=c))
        db.session.commit()
        items = Currency.query.order_by(Currency.code).all()
    return jsonify([c.to_dict() for c in items])


@settings_bp.route("/currencies", methods=["POST"])
@jwt_required()
def create_currency():
    data = request.get_json()
    code = (data.get("code") or "").strip().upper()
    if not code:
        return jsonify({"error": "Currency code required"}), 400
    if Currency.query.filter_by(code=code).first():
        return jsonify({"error": "Currency already exists"}), 400
    c = Currency(code=code, name=data.get("name") or code)
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@settings_bp.route("/currencies/<int:id>", methods=["PUT"])
@jwt_required()
def update_currency(id):
    c = Currency.query.get_or_404(id)
    data = request.get_json()
    if "code" in data:
        code = (data["code"] or "").strip().upper()
        if code and code != c.code:
            if Currency.query.filter_by(code=code).first():
                return jsonify({"error": "Currency code already exists"}), 400
            c.code = code
    if "name" in data:
        c.name = data["name"] or c.code
    db.session.commit()
    return jsonify(c.to_dict())


@settings_bp.route("/currencies/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_currency(id):
    Currency.query.filter_by(id=id).delete()
    db.session.commit()
    return jsonify({"message": "Currency deleted"})


@settings_bp.route("/crypto-networks", methods=["GET"])
@jwt_required()
def list_crypto_networks():
    items = CryptoNetwork.query.order_by(CryptoNetwork.name).all()
    if not items:
        for n in ["TRON", "ERC20"]:
            db.session.add(CryptoNetwork(name=n))
        db.session.commit()
        items = CryptoNetwork.query.order_by(CryptoNetwork.name).all()
    return jsonify([n.to_dict() for n in items])


@settings_bp.route("/crypto-networks", methods=["POST"])
@jwt_required()
def create_crypto_network():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Network name required"}), 400
    if CryptoNetwork.query.filter_by(name=name).first():
        return jsonify({"error": "Crypto network already exists"}), 400
    n = CryptoNetwork(name=name)
    db.session.add(n)
    db.session.commit()
    return jsonify(n.to_dict()), 201


@settings_bp.route("/crypto-networks/<int:id>", methods=["PUT"])
@jwt_required()
def update_crypto_network(id):
    n = CryptoNetwork.query.get_or_404(id)
    data = request.get_json()
    if "name" in data:
        name = (data["name"] or "").strip()
        if name and name != n.name:
            if CryptoNetwork.query.filter_by(name=name).first():
                return jsonify({"error": "Crypto network already exists"}), 400
            n.name = name
    db.session.commit()
    return jsonify(n.to_dict())


@settings_bp.route("/crypto-networks/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_crypto_network(id):
    CryptoNetwork.query.filter_by(id=id).delete()
    db.session.commit()
    return jsonify({"message": "Crypto network deleted"})


@settings_bp.route("/custom-fields", methods=["GET"])
@jwt_required()
def list_custom_fields():
    fields = CustomField.query.order_by(CustomField.name).all()
    return jsonify([f.to_dict() for f in fields])


@settings_bp.route("/custom-fields", methods=["POST"])
@jwt_required()
def create_custom_field():
    data = request.get_json()
    cf = CustomField(
        name=data["name"],
        field_type=data.get("field_type", "text"),
        required=data.get("required", False),
    )
    db.session.add(cf)
    db.session.commit()
    return jsonify(cf.to_dict()), 201


@settings_bp.route("/custom-fields/<int:id>", methods=["PUT"])
@jwt_required()
def update_custom_field(id):
    cf = CustomField.query.get_or_404(id)
    data = request.get_json()
    for field in ("name", "field_type", "required"):
        if field in data:
            setattr(cf, field, data[field])
    db.session.commit()
    return jsonify(cf.to_dict())


@settings_bp.route("/custom-fields/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_custom_field(id):
    cf = CustomField.query.get_or_404(id)
    db.session.delete(cf)
    db.session.commit()
    return jsonify({"message": "Custom field deleted"})


# --- Currency Conversion ---

@settings_bp.route("/currency-conversion", methods=["GET"])
@jwt_required()
def get_currency_conversion():
    config = CurrencyConversionConfig.query.first()
    rates = get_all_rates()
    return jsonify({
        "provider": (config and config.provider) or "coingecko",
        "api_key_set": bool(config and config.api_key),
        "rates": rates,
        "updated_at": (config and config.updated_at and config.updated_at.isoformat()) or None,
    })


@settings_bp.route("/currency-conversion", methods=["PUT"])
@jwt_required()
def update_currency_conversion():
    data = request.get_json() or {}
    config = CurrencyConversionConfig.query.first()
    if not config:
        config = CurrencyConversionConfig()
        db.session.add(config)
    if "provider" in data:
        config.provider = data["provider"]
    if "api_key" in data:
        config.api_key = data["api_key"] or None
    db.session.commit()
    return jsonify({"provider": config.provider, "api_key_set": bool(config.api_key)})


@settings_bp.route("/currency-conversion/test", methods=["POST"])
@jwt_required()
def test_currency_conversion():
    data = request.get_json() or {}
    ok, msg = test_connection(data.get("provider", "coingecko"), data.get("api_key"))
    return jsonify({"success": ok, "message": msg})


@settings_bp.route("/currency-conversion/refresh", methods=["POST"])
@jwt_required()
def refresh_currency_rates():
    rates = fetch_rates()
    return jsonify({"rates": get_all_rates(), "count": len(rates)})


@settings_bp.route("/seed-test-data", methods=["POST"])
@jwt_required()
def seed_test_data():
    """Generate 6 months of payroll history with bonuses, penalties, overtime, reimbursements."""
    from app.models import PayrollPeriod, PayrollLine, Employee, Payment
    from datetime import date, timedelta
    from random import randint, uniform

    today = date.today()
    created = []
    for i in range(6):
        d = today.replace(day=1) - timedelta(days=28 * (i + 1))
        m, y = d.month, d.year
        if PayrollPeriod.query.filter_by(month=m, year=y).first():
            continue
        period = PayrollPeriod(month=m, year=y, status="Finalized")
        db.session.add(period)
        db.session.flush()
        employees = Employee.query.filter_by(status="Active").all()
        for emp in employees:
            base = emp.effective_salary or 3000
            bonus = round(uniform(0, 500), 2) if randint(0, 2) == 0 else 0
            penalties = round(uniform(0, 100), 2) if randint(0, 4) == 0 else 0
            overtime = round(uniform(0, 20), 1) if randint(0, 2) == 0 else 0
            overtime_rate = emp.overtime_rate or 25
            overtime_payout = round(overtime * overtime_rate, 2)
            reimb = round(uniform(0, 200), 2) if randint(0, 3) == 0 else 0
            total = round(base + bonus - penalties + overtime_payout + reimb, 2)
            fiat = total if emp.payment_method == "Fiat" else (emp.fiat_salary_amount or 0 if emp.payment_method == "Split" else 0)
            crypto = total - fiat if emp.payment_method in ("Crypto", "Split") else 0
            line = PayrollLine(
                payroll_period_id=period.id,
                employee_id=emp.id,
                base_salary=base,
                bonus=bonus,
                penalties=penalties,
                overtime_hours=overtime,
                overtime_rate=overtime_rate,
                overtime_payout=overtime_payout,
                reimbursements=reimb,
                prorated_salary=base,
                total_payout=total,
                fiat_amount=fiat,
                crypto_amount=crypto,
                currency=emp.currency or "EUR",
            )
            db.session.add(line)
            db.session.flush()
            pay = Payment(
                employee_id=emp.id,
                payroll_line_id=line.id,
                amount=total,
                currency=emp.currency or "EUR",
                payment_type="Fiat" if fiat else "Crypto",
                status="Paid",
                payment_date=date(y, m, 28),
            )
            db.session.add(pay)
        created.append(f"{y}-{m:02d}")
    db.session.commit()
    return jsonify({"created": created, "message": f"Generated payroll for {len(created)} months"})
