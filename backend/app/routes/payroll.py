import csv
import io
from datetime import datetime, date

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required

from app import db
from app.models import PayrollPeriod, PayrollLine, Employee, Payment, Request, Invoice

payroll_bp = Blueprint("payroll", __name__)

WORKING_DAYS_PER_MONTH = 22

NUMERIC_FIELDS = {
    "bonus", "penalties", "adjustments", "overtime_hours", "hourly_hours", "reimbursements",
    "tax_reimbursement_percent", "tax_reimbursement_fixed",
}


def _to_float(val):
    if val is None or val == "" or val == "null":
        return 0.0
    return float(val)


def _calculate_tax_reimbursement(line):
    if line.tax_reimbursement_type == "percent":
        return round((line.prorated_salary or 0) * (_to_float(line.tax_reimbursement_percent) / 100.0), 2)
    if line.tax_reimbursement_type == "fixed":
        return round(_to_float(line.tax_reimbursement_fixed), 2)
    return 0.0


def _simulate_line(line_dict, employee):
    prorated_salary = _to_float(line_dict.get("prorated_salary", line_dict.get("base_salary", 0)))
    bonus = _to_float(line_dict.get("bonus", 0))
    penalties = _to_float(line_dict.get("penalties", 0))
    adjustments = _to_float(line_dict.get("adjustments", 0))
    reimbursements = _to_float(line_dict.get("reimbursements", 0))
    overtime_hours = _to_float(line_dict.get("overtime_hours", 0))
    overtime_rate = _to_float(line_dict.get("overtime_rate", employee.overtime_rate or 0))
    overtime_payout = round(overtime_hours * overtime_rate, 2)

    tr_type = line_dict.get("tax_reimbursement_type")
    tr_percent = _to_float(line_dict.get("tax_reimbursement_percent", 0))
    tr_fixed = _to_float(line_dict.get("tax_reimbursement_fixed", 0))
    if tr_type == "percent":
        tr_amount = round(prorated_salary * tr_percent / 100.0, 2)
    elif tr_type == "fixed":
        tr_amount = tr_fixed
    else:
        tr_amount = 0.0

    total = round(
        prorated_salary + bonus - penalties + adjustments + reimbursements + overtime_payout + tr_amount,
        2
    )

    if employee.payment_method == "Crypto":
        fiat_amount = 0.0
        crypto_amount = total
    elif employee.payment_method == "Split":
        fiat_amount = _to_float(employee.fiat_salary_amount or 0)
        crypto_amount = max(total - fiat_amount, 0.0)
    else:
        fiat_amount = total
        crypto_amount = 0.0

    return {
        "employee_id": employee.id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "currency": line_dict.get("currency") or employee.currency or "EUR",
        "base_salary": _to_float(line_dict.get("base_salary", employee.effective_salary or 0)),
        "prorated_salary": prorated_salary,
        "bonus": bonus,
        "penalties": penalties,
        "adjustments": adjustments,
        "reimbursements": reimbursements,
        "overtime_payout": overtime_payout,
        "tax_reimbursement_amount": tr_amount,
        "total_payout": total,
        "fiat_amount": fiat_amount,
        "crypto_amount": crypto_amount,
        "payment_method": employee.payment_method or "Fiat",
    }


def _build_simulation(period, line_overrides):
    simulated_lines = []
    for line in period.lines:
        emp = Employee.query.get(line.employee_id)
        if not emp:
            continue
        override = line_overrides.get(str(line.id), {})
        source = {
            "base_salary": line.base_salary,
            "prorated_salary": line.prorated_salary,
            "bonus": line.bonus,
            "penalties": line.penalties,
            "adjustments": line.adjustments,
            "reimbursements": line.reimbursements,
            "overtime_hours": line.overtime_hours,
            "overtime_rate": line.overtime_rate,
            "tax_reimbursement_type": line.tax_reimbursement_type,
            "tax_reimbursement_percent": line.tax_reimbursement_percent,
            "tax_reimbursement_fixed": line.tax_reimbursement_fixed,
            "currency": line.currency,
        }
        source.update(override or {})
        simulated_lines.append(_simulate_line(source, emp))

    currency_breakdown = {}
    payout_breakdown = {"bank": 0.0, "crypto": 0.0}
    totals = {
        "employees": len(simulated_lines),
        "base_payroll": 0.0,
        "bonuses": 0.0,
        "tax_reimbursements": 0.0,
        "total_payout": 0.0,
    }

    for line in simulated_lines:
        totals["base_payroll"] += line["prorated_salary"]
        totals["bonuses"] += line["bonus"]
        totals["tax_reimbursements"] += line["tax_reimbursement_amount"]
        totals["total_payout"] += line["total_payout"]
        currency = line["currency"] or "EUR"
        currency_breakdown[currency] = currency_breakdown.get(currency, 0.0) + line["total_payout"]
        payout_breakdown["bank"] += line["fiat_amount"]
        payout_breakdown["crypto"] += line["crypto_amount"]

    return {
        "employees": totals["employees"],
        "base_payroll": round(totals["base_payroll"], 2),
        "bonuses": round(totals["bonuses"], 2),
        "tax_reimbursements": round(totals["tax_reimbursements"], 2),
        "total_payout": round(totals["total_payout"], 2),
        "currency_breakdown": [{"currency": c, "amount": round(v, 2)} for c, v in sorted(currency_breakdown.items())],
        "payout_breakdown": {
            "bank": round(payout_breakdown["bank"], 2),
            "crypto": round(payout_breakdown["crypto"], 2),
        },
        "lines": simulated_lines,
    }


def compute_prorated_salary(employee, month, year):
    salary = employee.effective_salary or 0
    if employee.salary_type == "Hourly":
        return salary

    if employee.start_date and employee.start_date.year == year and employee.start_date.month == month:
        days_worked = WORKING_DAYS_PER_MONTH - min(employee.start_date.day, WORKING_DAYS_PER_MONTH)
        days_worked = max(days_worked, 0)
        return round(days_worked / WORKING_DAYS_PER_MONTH * salary, 2)

    return salary


def split_payment_amounts(employee, prorated_salary):
    method = employee.payment_method or "Fiat"
    if method == "Crypto":
        return 0, prorated_salary
    if method == "Split":
        fiat = employee.fiat_salary_amount or 0
        crypto = employee.crypto_salary_amount or 0
        return fiat, crypto
    return prorated_salary, 0


def recalculate_line(line):
    line.tax_reimbursement_amount = _calculate_tax_reimbursement(line)
    line.overtime_payout = round((line.overtime_hours or 0) * (line.overtime_rate or 0), 2)
    line.total_payout = round(
        (line.prorated_salary or 0)
        + (line.bonus or 0)
        - (line.penalties or 0)
        + (line.adjustments or 0)
        + (line.reimbursements or 0)
        + (line.tax_reimbursement_amount or 0)
        + line.overtime_payout,
        2,
    )
    emp = Employee.query.get(line.employee_id)
    if emp:
        method = emp.payment_method or "Fiat"
        if method == "Crypto":
            line.fiat_amount = 0
            line.crypto_amount = line.total_payout
        elif method == "Split":
            line.fiat_amount = emp.fiat_salary_amount or 0
            line.crypto_amount = max(line.total_payout - line.fiat_amount, 0)
        else:
            line.fiat_amount = line.total_payout
            line.crypto_amount = 0


def _apply_approved_requests(period):
    """Auto-apply approved (not yet completed) requests to payroll lines."""
    for line in period.lines:
        approved = Request.query.filter_by(
            employee_id=line.employee_id, status="Approved"
        ).all()
        for req in approved:
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
            req.status = "Completed"
        recalculate_line(line)


@payroll_bp.route("/", methods=["GET"])
@jwt_required()
def list_payroll_periods():
    periods = PayrollPeriod.query.order_by(
        PayrollPeriod.year.desc(), PayrollPeriod.month.desc()
    ).all()
    return jsonify([p.to_dict() for p in periods])


@payroll_bp.route("/", methods=["POST"])
@jwt_required()
def create_payroll_period():
    data = request.get_json()
    month, year = int(data["month"]), int(data["year"])

    existing = PayrollPeriod.query.filter_by(month=month, year=year).first()
    if existing:
        return jsonify({"error": "Payroll period already exists"}), 400

    period = PayrollPeriod(month=month, year=year)
    db.session.add(period)
    db.session.flush()

    employees = Employee.query.filter_by(status="Active").all()
    for emp in employees:
        prorated = compute_prorated_salary(emp, month, year)
        fiat_amt, crypto_amt = split_payment_amounts(emp, prorated)

        line = PayrollLine(
            payroll_period_id=period.id,
            employee_id=emp.id,
            base_salary=emp.effective_salary or 0,
            currency=emp.currency or "EUR",
            overtime_rate=emp.overtime_rate or 0,
            working_days_total=WORKING_DAYS_PER_MONTH,
            working_days_worked=WORKING_DAYS_PER_MONTH,
            prorated_salary=prorated,
            fiat_amount=fiat_amt,
            crypto_amount=crypto_amt,
            total_payout=prorated,
        )

        if emp.start_date and emp.start_date.year == year and emp.start_date.month == month:
            days_worked = WORKING_DAYS_PER_MONTH - min(emp.start_date.day, WORKING_DAYS_PER_MONTH)
            line.working_days_worked = max(days_worked, 0)

        db.session.add(line)

    db.session.flush()
    _apply_approved_requests(period)
    db.session.commit()
    return jsonify(period.to_dict()), 201


@payroll_bp.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_payroll_period(id):
    period = PayrollPeriod.query.get_or_404(id)
    import os
    from flask import current_app
    for line in period.lines:
        for p in Payment.query.filter_by(payroll_line_id=line.id).all():
            db.session.delete(p)
    for inv in Invoice.query.filter_by(period_month=period.month, period_year=period.year).all():
        if inv.pdf_path and os.path.exists(inv.pdf_path):
            try:
                os.remove(inv.pdf_path)
            except OSError:
                pass
        if inv.uploaded_pdf_path and os.path.exists(inv.uploaded_pdf_path):
            try:
                os.remove(inv.uploaded_pdf_path)
            except OSError:
                pass
        db.session.delete(inv)
    for line in period.lines:
        db.session.delete(line)
    db.session.delete(period)
    db.session.commit()
    return jsonify({"deleted": id})


@payroll_bp.route("/<int:id>", methods=["GET"])
@jwt_required()
def get_payroll_period(id):
    period = PayrollPeriod.query.get_or_404(id)
    data = period.to_dict()
    data["lines"] = [l.to_dict() for l in period.lines]
    return jsonify(data)


@payroll_bp.route("/<int:id>/lines/<int:line_id>", methods=["PUT"])
@jwt_required()
def update_payroll_line(id, line_id):
    line = PayrollLine.query.filter_by(id=line_id, payroll_period_id=id).first_or_404()
    period = PayrollPeriod.query.get(id)
    if period and period.status == "Finalized":
        return jsonify({"error": "Cannot edit a finalized payroll"}), 400

    data = request.get_json()
    for field in (
        "bonus", "bonus_comment", "penalties", "penalties_comment",
        "adjustments", "adjustments_comment", "overtime_hours",
        "hourly_hours", "reimbursements",
        "tax_reimbursement_type", "tax_reimbursement_percent",
        "tax_reimbursement_fixed", "tax_reimbursement_comment",
    ):
        if field in data:
            val = data[field]
            if field in NUMERIC_FIELDS:
                val = _to_float(val)
            setattr(line, field, val)

    recalculate_line(line)
    db.session.commit()
    return jsonify(line.to_dict())


@payroll_bp.route("/<int:id>/simulate", methods=["POST"])
@jwt_required()
def simulate_payroll(id):
    period = PayrollPeriod.query.get_or_404(id)
    payload = request.get_json(silent=True) or {}
    overrides = payload.get("line_overrides", {})
    simulation = _build_simulation(period, overrides)
    return jsonify(simulation)


@payroll_bp.route("/<int:id>/simulate/export", methods=["POST"])
@jwt_required()
def export_simulation(id):
    """Export payroll simulation to CSV or PDF for finance approval."""
    period = PayrollPeriod.query.get_or_404(id)
    payload = request.get_json(silent=True) or {}
    overrides = payload.get("line_overrides", {})
    fmt = request.args.get("format", "csv").lower()
    simulation = _build_simulation(period, overrides)

    if fmt == "pdf":
        from fpdf import FPDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, f"Payroll Simulation - {period.year}-{period.month:02d}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(6)
        pdf.set_font("Helvetica", "", 9)
        col_w = [50, 30, 25, 30, 35]
        headers = ["Employee", "Base Salary", "Bonus", "Tax Reimb.", "Total Payout"]
        for i, h in enumerate(headers):
            pdf.cell(col_w[i], 7, h, border=1)
        pdf.ln(7)
        for line in simulation["lines"]:
            pdf.cell(col_w[0], 6, line["employee_name"][:25], border=1)
            pdf.cell(col_w[1], 6, f"{line['prorated_salary']:,.2f}", border=1)
            pdf.cell(col_w[2], 6, f"{line['bonus']:,.2f}", border=1)
            pdf.cell(col_w[3], 6, f"{line['tax_reimbursement_amount']:,.2f}", border=1)
            pdf.cell(col_w[4], 6, f"{line['total_payout']:,.2f}", border=1)
            pdf.ln(6)
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(col_w[0] + col_w[1] + col_w[2] + col_w[3], 6, "Summary", border=1)
        pdf.cell(col_w[4], 6, "", border=1)
        pdf.ln(6)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(col_w[0] + col_w[1] + col_w[2] + col_w[3], 5, f"Total employees: {simulation['employees']}", border=0)
        pdf.ln(5)
        pdf.cell(col_w[0] + col_w[1] + col_w[2] + col_w[3], 5, f"Total payroll: {simulation['base_payroll']:,.2f}", border=0)
        pdf.ln(5)
        pdf.cell(col_w[0] + col_w[1] + col_w[2] + col_w[3], 5, f"Total bonuses: {simulation['bonuses']:,.2f}", border=0)
        pdf.ln(5)
        pdf.cell(col_w[0] + col_w[1] + col_w[2] + col_w[3], 5, f"Total reimbursements: {simulation['tax_reimbursements']:,.2f}", border=0)
        pdf.ln(5)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(col_w[0] + col_w[1] + col_w[2] + col_w[3], 6, "Grand total payout:", border=0)
        pdf.cell(col_w[4], 6, f"{simulation['total_payout']:,.2f}", border=0)
        buf = io.BytesIO()
        buf.write(pdf.output())
        buf.seek(0)
        return Response(
            buf.getvalue(),
            mimetype="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=payroll_simulation_{period.year}_{period.month:02d}.pdf"},
        )

    output = io.StringIO()
    columns = ["employee_name", "base_salary", "bonus", "tax_reimbursement", "total_payout"]
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for line in simulation["lines"]:
        writer.writerow({
            "employee_name": line["employee_name"],
            "base_salary": f"{line['prorated_salary']:.2f}",
            "bonus": f"{line['bonus']:.2f}",
            "tax_reimbursement": f"{line['tax_reimbursement_amount']:.2f}",
            "total_payout": f"{line['total_payout']:.2f}",
        })
    writer.writerow({})
    writer.writerow({"employee_name": "Summary", "base_salary": "", "bonus": "", "tax_reimbursement": "", "total_payout": ""})
    writer.writerow({"employee_name": f"Total employees: {simulation['employees']}", "base_salary": "", "bonus": "", "tax_reimbursement": "", "total_payout": ""})
    writer.writerow({"employee_name": f"Total payroll: {simulation['base_payroll']:.2f}", "base_salary": "", "bonus": "", "tax_reimbursement": "", "total_payout": ""})
    writer.writerow({"employee_name": f"Total bonuses: {simulation['bonuses']:.2f}", "base_salary": "", "bonus": "", "tax_reimbursement": "", "total_payout": ""})
    writer.writerow({"employee_name": f"Total reimbursements: {simulation['tax_reimbursements']:.2f}", "base_salary": "", "bonus": "", "tax_reimbursement": "", "total_payout": ""})
    writer.writerow({"employee_name": f"Grand total payout: {simulation['total_payout']:.2f}", "base_salary": "", "bonus": "", "tax_reimbursement": "", "total_payout": ""})
    filename = f"payroll_simulation_{period.year}_{period.month:02d}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@payroll_bp.route("/<int:id>/finalize", methods=["POST"])
@jwt_required()
def finalize_payroll(id):
    period = PayrollPeriod.query.get_or_404(id)
    if period.status == "Finalized":
        return jsonify({"error": "Already finalized"}), 400
    period.status = "Finalized"
    period.finalized_at = datetime.utcnow()
    db.session.commit()
    return jsonify(period.to_dict())


@payroll_bp.route("/<int:id>/generate-payments", methods=["POST"])
@jwt_required()
def generate_payments(id):
    period = PayrollPeriod.query.get_or_404(id)
    created = 0

    for line in period.lines:
        emp = Employee.query.get(line.employee_id)
        if not emp:
            continue

        if line.fiat_amount and line.fiat_amount > 0:
            db.session.add(Payment(
                employee_id=emp.id,
                payroll_line_id=line.id,
                amount=line.fiat_amount,
                currency=line.currency,
                payment_type="Fiat",
                bank_name=emp.bank_name,
                iban=emp.iban,
                account_holder=emp.account_holder,
                swift=emp.swift,
            ))
            created += 1

        if line.crypto_amount and line.crypto_amount > 0:
            db.session.add(Payment(
                employee_id=emp.id,
                payroll_line_id=line.id,
                amount=line.crypto_amount,
                currency=emp.wallet_coin or line.currency,
                payment_type="Crypto",
                network=emp.wallet_network,
                wallet_address=emp.wallet_address,
                coin=emp.wallet_coin,
            ))
            created += 1

    db.session.commit()
    return jsonify({"message": f"{created} payments created"})


@payroll_bp.route("/<int:id>/export", methods=["GET"])
@jwt_required()
def export_payroll(id):
    period = PayrollPeriod.query.get_or_404(id)
    output = io.StringIO()
    columns = [
        "employee_id", "employee_name", "department", "base_salary",
        "prorated_salary", "bonus", "penalties", "adjustments",
        "reimbursements", "tax_reimbursement_amount", "overtime_payout", "fiat_amount", "crypto_amount",
        "total_payout", "currency",
    ]
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for line in period.lines:
        d = line.to_dict()
        writer.writerow({
            "employee_id": d["employee_eid"],
            "employee_name": d["employee_name"],
            "department": d["department"],
            "base_salary": d["base_salary"],
            "prorated_salary": d["prorated_salary"],
            "bonus": d["bonus"],
            "penalties": d["penalties"],
            "adjustments": d["adjustments"],
            "reimbursements": d["reimbursements"],
            "tax_reimbursement_amount": d["tax_reimbursement_amount"],
            "overtime_payout": d["overtime_payout"],
            "fiat_amount": d["fiat_amount"],
            "crypto_amount": d["crypto_amount"],
            "total_payout": d["total_payout"],
            "currency": d["currency"],
        })

    filename = f"payroll_{period.year}_{period.month:02d}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
