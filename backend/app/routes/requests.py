import os
from datetime import date

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required

from app import db
from app.models import Request, PayrollPeriod, PayrollLine

requests_bp = Blueprint("requests", __name__)

REQUEST_TYPES = ["Bonus", "Salary Adjustment", "Penalty", "Reimbursement", "Other"]


def _apply_request_to_draft_payroll(req):
    """If a draft payroll exists for the current month, apply the approved request."""
    today = date.today()
    period = PayrollPeriod.query.filter_by(
        month=today.month, year=today.year, status="Draft"
    ).first()
    if not period:
        return

    line = PayrollLine.query.filter_by(
        payroll_period_id=period.id, employee_id=req.employee_id
    ).first()
    if not line:
        return

    amount = req.amount or 0
    comment_prefix = f"[Request #{req.id}] "

    if req.request_type == "Bonus":
        line.bonus = (line.bonus or 0) + amount
        line.bonus_comment = ((line.bonus_comment or "") + " " + comment_prefix + (req.title or "")).strip()
    elif req.request_type == "Penalty":
        line.penalties = (line.penalties or 0) + amount
        line.penalties_comment = ((line.penalties_comment or "") + " " + comment_prefix + (req.title or "")).strip()
    elif req.request_type == "Salary Adjustment":
        line.adjustments = (line.adjustments or 0) + amount
        line.adjustments_comment = ((line.adjustments_comment or "") + " " + comment_prefix + (req.title or "")).strip()
    elif req.request_type == "Reimbursement":
        line.reimbursements = (line.reimbursements or 0) + amount

    from app.routes.payroll import recalculate_line
    recalculate_line(line)


@requests_bp.route("/", methods=["GET"])
@jwt_required()
def list_requests():
    q = Request.query

    for param, col in [
        ("employee_id", Request.employee_id),
        ("status", Request.status),
        ("request_type", Request.request_type),
    ]:
        val = request.args.get(param)
        if val:
            q = q.filter(col == val)

    requests_list = q.order_by(Request.date_created.desc()).all()
    return jsonify([r.to_dict() for r in requests_list])


@requests_bp.route("/<int:id>", methods=["GET"])
@jwt_required()
def get_request(id):
    req = Request.query.get_or_404(id)
    return jsonify(req.to_dict())


@requests_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    data = request.get_json()

    if data.get("request_type") and data["request_type"] not in REQUEST_TYPES:
        return jsonify({"error": f"Invalid request_type. Must be one of: {REQUEST_TYPES}"}), 400

    req = Request(
        title=data["title"],
        employee_id=data["employee_id"],
        description=data.get("description"),
        request_type=data["request_type"],
        requested_by=data.get("requested_by"),
        amount=float(data["amount"]) if data.get("amount") else None,
        currency=data.get("currency"),
        comment=data.get("comment"),
    )
    db.session.add(req)
    db.session.commit()
    return jsonify(req.to_dict()), 201


@requests_bp.route("/<int:id>", methods=["PUT"])
@jwt_required()
def update_request(id):
    req = Request.query.get_or_404(id)
    data = request.get_json()

    old_status = req.status

    for field in ("title", "description", "request_type", "requested_by",
                   "status", "currency", "comment"):
        if field in data:
            setattr(req, field, data[field])

    if "amount" in data:
        req.amount = float(data["amount"]) if data["amount"] is not None else None

    if old_status != "Approved" and req.status == "Approved":
        _apply_request_to_draft_payroll(req)

    db.session.commit()
    return jsonify(req.to_dict())


@requests_bp.route("/<int:id>/approve", methods=["PUT"])
@jwt_required()
def approve_request(id):
    req = Request.query.get_or_404(id)
    req.status = "Approved"
    _apply_request_to_draft_payroll(req)
    db.session.commit()
    return jsonify(req.to_dict())


@requests_bp.route("/<int:id>/reject", methods=["PUT"])
@jwt_required()
def reject_request(id):
    req = Request.query.get_or_404(id)
    req.status = "Rejected"
    db.session.commit()
    return jsonify(req.to_dict())


@requests_bp.route("/<int:id>/complete", methods=["PUT"])
@jwt_required()
def complete_request(id):
    req = Request.query.get_or_404(id)
    req.status = "Completed"
    db.session.commit()
    return jsonify(req.to_dict())


@requests_bp.route("/<int:id>/upload-attachment", methods=["POST"])
@jwt_required()
def upload_attachment(id):
    req = Request.query.get_or_404(id)
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    upload_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], "requests")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"request_{req.id}_{file.filename}"
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    req.attachment_path = filepath
    db.session.commit()
    return jsonify(req.to_dict())


@requests_bp.route("/<int:id>/download-attachment", methods=["GET"])
@jwt_required()
def download_attachment(id):
    req = Request.query.get_or_404(id)
    if not req.attachment_path or not os.path.exists(req.attachment_path):
        return jsonify({"error": "No attachment found"}), 404
    return send_file(req.attachment_path, as_attachment=True)
