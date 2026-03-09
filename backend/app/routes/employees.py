import csv
import io
import re
from datetime import datetime, date

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import (
    Employee, Department, LegalEntity, CustomFieldValue, User, CompensationHistory,
    PayoutAuditLog, Payment, Invoice, Request,
)

employees_bp = Blueprint("employees", __name__)

BASE58_CHARS = set("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")


def validate_wallet(address, network):
    if not address:
        return None
    if network == "TRON":
        if not address.startswith("T") or len(address) != 34:
            return "TRON address must start with 'T' and be 34 characters"
        if not all(c in BASE58_CHARS for c in address):
            return "TRON address contains invalid base58 characters"
    elif network == "ERC20":
        if not address.startswith("0x") or len(address) != 42:
            return "ERC20 address must start with '0x' and be 42 characters"
        if not re.match(r"^0x[0-9a-fA-F]{40}$", address):
            return "ERC20 address contains invalid hex characters"
    return None


EMPLOYEE_FIELDS = [
    "employee_id", "first_name", "last_name", "email", "country",
    "department_id", "job_title", "manager", "employment_type",
    "legal_entity_id", "telegram", "slack", "start_date", "status",
    "notes", "internal_notes", "base_salary", "post_probation_salary",
    "probation_end_date", "salary_type", "currency", "payment_method",
    "bank_name", "iban", "account_holder", "swift", "wallet_address",
    "wallet_network", "wallet_coin", "fiat_salary_amount",
    "crypto_salary_amount", "overtime_rate",
]

SELF_SERVICE_EDITABLE_FIELDS = {
    "email", "country", "telegram", "slack",
    "bank_name", "iban", "account_holder", "swift",
    "wallet_address", "wallet_network", "wallet_coin",
}


def _current_user():
    uid = int(get_jwt_identity())
    return User.query.get(uid)


def _is_admin(user):
    return bool(user and user.role == "admin")


def _ensure_employee_access(user, employee_id):
    if _is_admin(user):
        return True
    return bool(user and user.employee_id == employee_id)


PAYOUT_AUDIT_FIELDS = {
    "bank_name", "iban", "account_holder", "swift",
    "wallet_address", "wallet_network", "wallet_coin", "payment_method",
}


def _log_payout_changes(emp, data, changed_by_name):
    """Log changes to payout-related fields for audit trail."""
    for field in PAYOUT_AUDIT_FIELDS:
        if field not in data:
            continue
        old_val = getattr(emp, field, None)
        new_val = data.get(field) or None
        if str(old_val or "") != str(new_val or ""):
            db.session.add(PayoutAuditLog(
                employee_id=emp.id,
                field_changed=field,
                old_value=str(old_val)[:500] if old_val else None,
                new_value=str(new_val)[:500] if new_val else None,
                changed_by=changed_by_name,
            ))


def _create_compensation_entry(emp, changed_by_user_id=None, note=None, effective_date=None):
    entry = CompensationHistory(
        employee_id=emp.id,
        effective_date=effective_date or date.today(),
        base_salary=emp.base_salary or 0,
        currency=emp.currency or "EUR",
        note=note,
        changed_by_user_id=changed_by_user_id,
    )
    db.session.add(entry)


def apply_employee_data(emp, data):
    for field in EMPLOYEE_FIELDS:
        if field in data:
            val = data[field]
            if field in ("start_date", "probation_end_date") and isinstance(val, str) and val:
                val = datetime.strptime(val, "%Y-%m-%d").date()
            elif field in ("base_salary", "post_probation_salary", "fiat_salary_amount",
                           "crypto_salary_amount", "overtime_rate") and val is not None:
                val = float(val)
            elif field in ("department_id", "legal_entity_id") and val is not None:
                val = int(val)
            setattr(emp, field, val)


@employees_bp.route("/", methods=["GET"])
@jwt_required()
def list_employees():
    user = _current_user()
    show_inactive = request.args.get("status") == "Inactive"
    q = Employee.query if show_inactive else Employee.query.filter(Employee.status != "Inactive")

    if not _is_admin(user):
        if not user or not user.employee_id:
            return jsonify([])
        q = q.filter(Employee.id == user.employee_id)

    search = request.args.get("search")
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            db.or_(
                Employee.first_name.ilike(pattern),
                Employee.last_name.ilike(pattern),
                Employee.employee_id.ilike(pattern),
                Employee.email.ilike(pattern),
            )
        )

    dept = request.args.get("department") or request.args.get("department_id")
    if dept:
        q = q.filter(Employee.department_id == int(dept))

    le = request.args.get("legal_entity") or request.args.get("legal_entity_id")
    if le:
        q = q.filter(Employee.legal_entity_id == int(le))

    et = request.args.get("employment_type")
    if et:
        q = q.filter(Employee.employment_type == et)

    status_filter = request.args.get("status")
    if status_filter:
        q = q.filter(Employee.status == status_filter)

    employees = q.order_by(Employee.first_name).all()
    return jsonify([e.to_dict() for e in employees])


@employees_bp.route("/<int:id>", methods=["GET"])
@jwt_required()
def get_employee(id):
    user = _current_user()
    if not _ensure_employee_access(user, id):
        return jsonify({"error": "Forbidden"}), 403
    emp = Employee.query.get_or_404(id)
    data = emp.to_dict()
    data["custom_fields"] = [cfv.to_dict() for cfv in emp.custom_field_values]
    return jsonify(data)


@employees_bp.route("/", methods=["POST"])
@jwt_required()
def create_employee():
    user = _current_user()
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    data = request.get_json()
    if Employee.query.filter_by(employee_id=data.get("employee_id")).first():
        return jsonify({"error": "Employee ID already exists"}), 400

    wallet_err = validate_wallet(data.get("wallet_address"), data.get("wallet_network"))
    if wallet_err:
        return jsonify({"error": wallet_err}), 400

    emp = Employee()
    apply_employee_data(emp, data)
    db.session.add(emp)
    db.session.flush()
    _create_compensation_entry(
        emp,
        changed_by_user_id=user.id if user else None,
        note="Initial salary",
        effective_date=emp.start_date or date.today(),
    )
    db.session.commit()
    return jsonify(emp.to_dict()), 201


@employees_bp.route("/<int:id>", methods=["PUT"])
@jwt_required()
def update_employee(id):
    user = _current_user()
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    emp = Employee.query.get_or_404(id)
    data = request.get_json()
    old_base_salary = emp.base_salary
    old_currency = emp.currency

    if "employee_id" in data and data["employee_id"] != emp.employee_id:
        if Employee.query.filter_by(employee_id=data["employee_id"]).first():
            return jsonify({"error": "Employee ID already exists"}), 400

    wallet_err = validate_wallet(
        data.get("wallet_address", emp.wallet_address),
        data.get("wallet_network", emp.wallet_network),
    )
    if wallet_err:
        return jsonify({"error": wallet_err}), 400

    changed_by_name = user.name if user else "admin"
    _log_payout_changes(emp, data, changed_by_name)
    apply_employee_data(emp, data)
    if old_base_salary != emp.base_salary or old_currency != emp.currency:
        _create_compensation_entry(
            emp,
            changed_by_user_id=user.id if user else None,
            note=data.get("salary_change_note") or "Salary updated by admin",
            effective_date=date.today(),
        )
    db.session.commit()
    return jsonify(emp.to_dict())


@employees_bp.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_employee(id):
    user = _current_user()
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    emp = Employee.query.get_or_404(id)
    emp.status = "Inactive"
    db.session.commit()
    return jsonify({"message": "Employee deactivated"})


@employees_bp.route("/import-csv", methods=["POST"])
@jwt_required()
def import_csv():
    user = _current_user()
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    stream = io.StringIO(file.stream.read().decode("utf-8-sig"))
    reader = csv.DictReader(stream)
    created, errors = [], []

    dept_cache = {d.name.lower(): d.id for d in Department.query.all()}
    le_cache = {le.name.lower(): le.id for le in LegalEntity.query.all()}

    for i, row in enumerate(reader, start=2):
        eid = row.get("employee_id", "").strip()
        if not eid:
            errors.append(f"Row {i}: missing employee_id")
            continue
        if Employee.query.filter_by(employee_id=eid).first():
            errors.append(f"Row {i}: employee_id '{eid}' already exists")
            continue

        emp = Employee(
            employee_id=eid,
            first_name=row.get("first_name", "").strip(),
            last_name=row.get("last_name", "").strip(),
            email=row.get("email", "").strip() or None,
            country=row.get("country", "").strip() or None,
            employment_type=row.get("employment_type", "").strip() or None,
            base_salary=float(row["base_salary"]) if row.get("base_salary") else 0,
            salary_type=row.get("salary_type", "").strip() or "Monthly",
            currency=row.get("currency", "").strip() or "EUR",
            payment_method=row.get("payment_method", "").strip() or "Fiat",
            bank_name=row.get("bank_name", "").strip() or None,
            iban=row.get("iban", "").strip() or None,
            account_holder=row.get("account_holder", "").strip() or None,
            swift=row.get("swift", "").strip() or None,
            wallet_address=row.get("wallet_address", "").strip() or None,
            wallet_network=row.get("wallet_network", "").strip() or None,
            wallet_coin=row.get("wallet_coin", "").strip() or None,
            manager=row.get("manager", "").strip() or None,
            telegram=row.get("telegram", "").strip() or None,
            slack=row.get("slack", "").strip() or None,
        )

        dept_name = row.get("department", "").strip().lower()
        if dept_name and dept_name in dept_cache:
            emp.department_id = dept_cache[dept_name]

        le_name = row.get("legal_entity", "").strip().lower()
        if le_name and le_name in le_cache:
            emp.legal_entity_id = le_cache[le_name]

        wallet_err = validate_wallet(emp.wallet_address, emp.wallet_network)
        if wallet_err:
            errors.append(f"Row {i}: {wallet_err}")
            continue

        db.session.add(emp)
        db.session.flush()
        _create_compensation_entry(
            emp,
            changed_by_user_id=user.id if user else None,
            note="Imported from CSV",
            effective_date=emp.start_date or date.today(),
        )
        created.append(eid)

    db.session.commit()
    return jsonify({"created": len(created), "errors": errors})


@employees_bp.route("/export-csv", methods=["GET"])
@jwt_required()
def export_csv():
    user = _current_user()
    if not _is_admin(user):
        return jsonify({"error": "Admin access required"}), 403
    employees = Employee.query.order_by(Employee.first_name).all()
    output = io.StringIO()
    columns = [
        "employee_id", "first_name", "last_name", "country", "department",
        "employment_type", "legal_entity", "base_salary", "salary_type",
        "currency", "payment_method", "bank_name", "iban", "account_holder", "swift",
        "wallet_address", "wallet_network", "wallet_coin", "manager",
        "telegram", "slack", "email",
    ]
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for emp in employees:
        writer.writerow({col: emp.to_dict().get(col, "") for col in columns})

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=employees.csv"},
    )


@employees_bp.route("/<int:id>/compensation-history", methods=["GET"])
@jwt_required()
def get_compensation_history(id):
    user = _current_user()
    if not _ensure_employee_access(user, id):
        return jsonify({"error": "Forbidden"}), 403
    rows = CompensationHistory.query.filter_by(employee_id=id).order_by(
        CompensationHistory.effective_date.asc(),
        CompensationHistory.created_at.asc(),
    ).all()
    if not rows:
        emp = Employee.query.get_or_404(id)
        _create_compensation_entry(
            emp,
            changed_by_user_id=user.id if user else None,
            note="Initial salary",
            effective_date=emp.start_date or date.today(),
        )
        db.session.commit()
        rows = CompensationHistory.query.filter_by(employee_id=id).order_by(
            CompensationHistory.effective_date.asc(),
            CompensationHistory.created_at.asc(),
        ).all()
    return jsonify([r.to_dict() for r in rows])


@employees_bp.route("/me/portal-data", methods=["GET"])
@jwt_required()
def get_my_portal_data():
    """Employee portal data (for non-admin users)."""
    user = _current_user()
    if not user or not user.employee_id:
        return jsonify({"error": "Employee profile is not linked"}), 400
    return _portal_data_for_employee(user.employee_id)


@employees_bp.route("/<int:id>/portal-data", methods=["GET"])
@jwt_required()
def get_employee_portal_data(id):
    """Employee portal data (for admin viewing any employee)."""
    user = _current_user()
    if not _ensure_employee_access(user, id):
        return jsonify({"error": "Forbidden"}), 403
    return _portal_data_for_employee(id)


def _safe_to_dict(obj, default=None):
    """Safely call to_dict, return default on error."""
    if obj is None:
        return default
    try:
        return obj.to_dict()
    except Exception:
        return default


def _portal_data_for_employee(employee_id):
    """Return all portal data for an employee in one response."""
    emp = Employee.query.get_or_404(employee_id)
    emp_data = emp.to_dict()
    emp_data["custom_fields"] = [_safe_to_dict(cfv, {}) for cfv in (emp.custom_field_values or [])]

    payments = Payment.query.filter_by(employee_id=employee_id).order_by(Payment.created_at.desc()).all()
    invoices = Invoice.query.filter_by(employee_id=employee_id).order_by(Invoice.created_at.desc()).all()
    requests_list = Request.query.filter_by(employee_id=employee_id).order_by(Request.date_created.desc()).all()

    comp_rows = CompensationHistory.query.filter_by(employee_id=employee_id).order_by(
        CompensationHistory.effective_date.asc(),
        CompensationHistory.created_at.asc(),
    ).all()
    if not comp_rows:
        _create_compensation_entry(
            emp,
            changed_by_user_id=None,
            note="Initial salary",
            effective_date=emp.start_date or date.today(),
        )
        db.session.commit()
        comp_rows = CompensationHistory.query.filter_by(employee_id=employee_id).order_by(
            CompensationHistory.effective_date.asc(),
            CompensationHistory.created_at.asc(),
        ).all()

    payout_logs = PayoutAuditLog.query.filter_by(employee_id=employee_id).order_by(
        PayoutAuditLog.timestamp.desc()
    ).limit(100).all()

    return jsonify({
        "employee": emp_data,
        "payments": [p.to_dict() for p in payments],
        "invoices": [i.to_dict() for i in invoices],
        "requests": [r.to_dict() for r in requests_list],
        "compensation_history": [r.to_dict() for r in comp_rows],
        "payout_history": [l.to_dict() for l in payout_logs],
    })


@employees_bp.route("/me/profile", methods=["GET"])
@jwt_required()
def get_my_profile():
    user = _current_user()
    if not user or not user.employee_id:
        return jsonify({"error": "Employee profile is not linked"}), 400
    emp = Employee.query.get_or_404(user.employee_id)
    data = emp.to_dict()
    data["custom_fields"] = [cfv.to_dict() for cfv in emp.custom_field_values]
    return jsonify(data)


@employees_bp.route("/me/profile", methods=["PUT"])
@jwt_required()
def update_my_profile():
    user = _current_user()
    if not user or not user.employee_id:
        return jsonify({"error": "Employee profile is not linked"}), 400
    emp = Employee.query.get_or_404(user.employee_id)
    data = request.get_json() or {}

    unknown_fields = [k for k in data.keys() if k not in SELF_SERVICE_EDITABLE_FIELDS]
    if unknown_fields:
        return jsonify({"error": f"Forbidden fields: {', '.join(sorted(unknown_fields))}"}), 400

    wallet_err = validate_wallet(
        data.get("wallet_address", emp.wallet_address),
        data.get("wallet_network", emp.wallet_network),
    )
    if wallet_err:
        return jsonify({"error": wallet_err}), 400

    changed_by_name = user.name if user else "employee"
    _log_payout_changes(emp, data, changed_by_name)
    for field in SELF_SERVICE_EDITABLE_FIELDS:
        if field in data:
            setattr(emp, field, data[field] or None)

    db.session.commit()
    return jsonify(emp.to_dict())


@employees_bp.route("/<int:id>/payout-history", methods=["GET"])
@jwt_required()
def get_payout_history(id):
    user = _current_user()
    if not _ensure_employee_access(user, id):
        return jsonify({"error": "Forbidden"}), 403
    logs = PayoutAuditLog.query.filter_by(employee_id=id).order_by(
        PayoutAuditLog.timestamp.desc()
    ).limit(100).all()
    return jsonify([l.to_dict() for l in logs])
