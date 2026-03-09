from datetime import date, datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.models import PayrollPeriod, PayrollLine, Employee, Department

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/payroll-by-month", methods=["GET"])
@jwt_required()
def payroll_by_month():
    today = date.today()
    results = []

    for i in range(11, -1, -1):
        d = today.replace(day=1) - timedelta(days=i * 28)
        m, y = d.month, d.year
        period = PayrollPeriod.query.filter_by(month=m, year=y).first()
        total = fiat = crypto = 0
        if period:
            total = sum(l.total_payout or 0 for l in period.lines)
            fiat = sum(l.fiat_amount or 0 for l in period.lines)
            crypto = sum(l.crypto_amount or 0 for l in period.lines)
        results.append({
            "month": m,
            "year": y,
            "period_label": f"{y}-{m:02d}",
            "total": total,
            "fiat_total": fiat,
            "crypto_total": crypto,
        })

    return jsonify(results)


@reports_bp.route("/payroll-by-department", methods=["GET"])
@jwt_required()
def payroll_by_department():
    month = request.args.get("month", date.today().month, type=int)
    year = request.args.get("year", date.today().year, type=int)

    period = PayrollPeriod.query.filter_by(month=month, year=year).first()
    if not period:
        return jsonify([])

    dept_data = {}
    for line in period.lines:
        emp = Employee.query.get(line.employee_id)
        dept = emp.department if emp else "Unassigned"
        if dept not in dept_data:
            dept_data[dept] = {"total": 0, "count": 0}
        dept_data[dept]["total"] += line.total_payout or 0
        dept_data[dept]["count"] += 1

    return jsonify([
        {"department": d, "total": v["total"], "employee_count": v["count"]}
        for d, v in sorted(dept_data.items(), key=lambda x: x[1]["total"], reverse=True)
    ])


@reports_bp.route("/payroll-by-legal-entity", methods=["GET"])
@jwt_required()
def payroll_by_legal_entity():
    month = request.args.get("month", date.today().month, type=int)
    year = request.args.get("year", date.today().year, type=int)

    period = PayrollPeriod.query.filter_by(month=month, year=year).first()
    if not period:
        return jsonify([])

    le_data = {}
    for line in period.lines:
        emp = Employee.query.get(line.employee_id)
        le_name = emp.legal_entity if emp else "Unassigned"
        if le_name not in le_data:
            le_data[le_name] = {"total": 0, "count": 0}
        le_data[le_name]["total"] += line.total_payout or 0
        le_data[le_name]["count"] += 1

    return jsonify([
        {"legal_entity": le, "total": v["total"], "employee_count": v["count"]}
        for le, v in sorted(le_data.items(), key=lambda x: x[1]["total"], reverse=True)
    ])


@reports_bp.route("/crypto-vs-fiat", methods=["GET"])
@jwt_required()
def crypto_vs_fiat():
    month = request.args.get("month", date.today().month, type=int)
    year = request.args.get("year", date.today().year, type=int)

    period = PayrollPeriod.query.filter_by(month=month, year=year).first()
    if not period:
        return jsonify({"crypto_total": 0, "fiat_total": 0, "crypto_percentage": 0, "fiat_percentage": 0})

    crypto = sum(l.crypto_amount or 0 for l in period.lines)
    fiat = sum(l.fiat_amount or 0 for l in period.lines)
    total = crypto + fiat

    return jsonify({
        "crypto_total": crypto,
        "fiat_total": fiat,
        "crypto_percentage": round(crypto / total * 100, 1) if total else 0,
        "fiat_percentage": round(fiat / total * 100, 1) if total else 0,
    })


@reports_bp.route("/salary-distribution", methods=["GET"])
@jwt_required()
def salary_distribution():
    employees = Employee.query.filter(Employee.status == "Active").all()
    ranges = [
        (0, 1000), (1000, 2000), (2000, 3000), (3000, 5000),
        (5000, 7500), (7500, 10000), (10000, float("inf")),
    ]
    result = []
    for low, high in ranges:
        label = f"{low}-{high}" if high != float("inf") else f"{low}+"
        count = sum(1 for e in employees if low <= (e.effective_salary or 0) < high)
        result.append({"range": label, "count": count})
    return jsonify(result)


@reports_bp.route("/payroll-trends", methods=["GET"])
@jwt_required()
def payroll_trends():
    today = date.today()
    results = []
    prev_total = None

    for i in range(11, -1, -1):
        d = today.replace(day=1) - timedelta(days=i * 28)
        m, y = d.month, d.year
        period = PayrollPeriod.query.filter_by(month=m, year=y).first()
        total = sum(l.total_payout or 0 for l in period.lines) if period else 0

        growth = None
        if prev_total is not None and prev_total > 0:
            growth = round((total - prev_total) / prev_total * 100, 1)

        results.append({
            "month": m,
            "year": y,
            "period_label": f"{y}-{m:02d}",
            "total": total,
            "growth_pct": growth,
        })
        prev_total = total

    return jsonify(results)


@reports_bp.route("/top-departments", methods=["GET"])
@jwt_required()
def top_departments():
    month = request.args.get("month", date.today().month, type=int)
    year = request.args.get("year", date.today().year, type=int)

    period = PayrollPeriod.query.filter_by(month=month, year=year).first()
    if not period:
        return jsonify([])

    dept_totals = {}
    for line in period.lines:
        emp = Employee.query.get(line.employee_id)
        dept = emp.department if emp else "Unassigned"
        dept_totals[dept] = dept_totals.get(dept, 0) + (line.total_payout or 0)

    return jsonify([
        {"department": d, "total": t}
        for d, t in sorted(dept_totals.items(), key=lambda x: x[1], reverse=True)
    ])
