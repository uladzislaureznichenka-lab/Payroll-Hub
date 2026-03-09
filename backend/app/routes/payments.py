import csv
import io
from datetime import date, datetime

from flask import Blueprint, request, jsonify, Response, send_file
from flask_jwt_extended import jwt_required
import openpyxl

from app import db
from app.models import Payment, Employee

payments_bp = Blueprint("payments", __name__)


@payments_bp.route("/", methods=["GET"])
@jwt_required()
def list_payments():
    q = Payment.query.join(Employee, Payment.employee_id == Employee.id)

    for param, col in [
        ("employee_id", Payment.employee_id),
        ("status", Payment.status),
        ("payment_type", Payment.payment_type),
        ("currency", Payment.currency),
        ("legal_entity_id", Employee.legal_entity_id),
    ]:
        val = request.args.get(param)
        if val:
            q = q.filter(col == val)

    month = request.args.get("month")
    year = request.args.get("year")
    if month:
        q = q.filter(db.extract("month", Payment.payment_date) == int(month))
    if year:
        q = q.filter(db.extract("year", Payment.payment_date) == int(year))

    payments = q.order_by(Payment.created_at.desc()).all()
    return jsonify([p.to_dict() for p in payments])


@payments_bp.route("/<int:id>", methods=["GET"])
@jwt_required()
def get_payment(id):
    payment = Payment.query.get_or_404(id)
    return jsonify(payment.to_dict())


@payments_bp.route("/<int:id>", methods=["PUT"])
@jwt_required()
def update_payment(id):
    payment = Payment.query.get_or_404(id)
    data = request.get_json()

    for field in ("status", "tx_hash", "comment"):
        if field in data:
            setattr(payment, field, data[field])

    if "payment_date" in data and data["payment_date"]:
        payment.payment_date = datetime.strptime(data["payment_date"], "%Y-%m-%d").date()

    db.session.commit()
    return jsonify(payment.to_dict())


@payments_bp.route("/<int:id>/mark-paid", methods=["POST"])
@jwt_required()
def mark_paid(id):
    payment = Payment.query.get_or_404(id)
    payment.status = "Paid"
    if not payment.payment_date:
        payment.payment_date = date.today()
    db.session.commit()
    return jsonify(payment.to_dict())


def _build_payment_query():
    q = Payment.query.join(Employee, Payment.employee_id == Employee.id)
    for param, col in [
        ("employee_id", Payment.employee_id),
        ("status", Payment.status),
        ("payment_type", Payment.payment_type),
        ("currency", Payment.currency),
        ("legal_entity_id", Employee.legal_entity_id),
    ]:
        val = request.args.get(param)
        if val:
            q = q.filter(col == val)
    month = request.args.get("month")
    year = request.args.get("year")
    if month:
        q = q.filter(db.extract("month", Payment.payment_date) == int(month))
    if year:
        q = q.filter(db.extract("year", Payment.payment_date) == int(year))
    return q.order_by(Payment.created_at.desc()).all()


EXPORT_COLUMNS = [
    "id", "employee_name", "employee_eid", "amount", "currency",
    "payment_type", "payment_date", "status", "network", "wallet_address",
    "coin", "tx_hash", "bank_name", "iban", "account_holder", "swift", "comment",
    "payroll_period_label", "base_salary", "bonus", "tax_reimbursement_amount", "total_payout",
]


@payments_bp.route("/export", methods=["GET"])
@jwt_required()
def export_csv():
    payments = _build_payment_query()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=EXPORT_COLUMNS)
    writer.writeheader()
    for p in payments:
        d = p.to_dict()
        writer.writerow({col: d.get(col, "") for col in EXPORT_COLUMNS})

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=payments.csv"},
    )


@payments_bp.route("/export-excel", methods=["GET"])
@jwt_required()
def export_excel():
    payments = _build_payment_query()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Payments"
    ws.append(EXPORT_COLUMNS)

    for p in payments:
        d = p.to_dict()
        ws.append([d.get(col, "") for col in EXPORT_COLUMNS])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="payments.xlsx",
    )
