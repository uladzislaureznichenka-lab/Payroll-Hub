from datetime import date, timedelta

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app import db
from app.models import (
    Employee, PayrollPeriod, PayrollLine, Payment, Department,
)

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/", methods=["GET"])
@jwt_required()
def get_dashboard():
    today = date.today()
    current_period = PayrollPeriod.query.filter_by(
        month=today.month, year=today.year
    ).first()

    total_payout = 0
    total_fiat = 0
    total_crypto = 0
    if current_period:
        total_payout = sum(l.total_payout or 0 for l in current_period.lines)
        total_fiat = sum(l.fiat_amount or 0 for l in current_period.lines)
        total_crypto = sum(l.crypto_amount or 0 for l in current_period.lines)

    active_count = Employee.query.filter_by(status="Active").count()
    inactive_count = Employee.query.filter_by(status="Inactive").count()
    pending_payments = Payment.query.filter_by(status="Pending").count()

    dept_salary = {}
    active_employees = Employee.query.filter_by(status="Active").all()
    for emp in active_employees:
        dept = emp.department or "Unassigned"
        if dept not in dept_salary:
            dept_salary[dept] = {"total": 0, "count": 0}
        dept_salary[dept]["total"] += emp.effective_salary or 0
        dept_salary[dept]["count"] += 1

    avg_salary_by_department = [
        {
            "department": d,
            "avg_salary": round(v["total"] / v["count"], 2) if v["count"] else 0,
        }
        for d, v in sorted(dept_salary.items())
    ]

    payroll_by_department = []
    payroll_by_le = []
    if current_period:
        dept_totals = {}
        le_totals = {}
        for line in current_period.lines:
            emp = Employee.query.get(line.employee_id)
            dept = emp.department if emp else "Unassigned"
            le = emp.legal_entity if emp else "Unassigned"
            dept_totals[dept] = dept_totals.get(dept, 0) + (line.total_payout or 0)
            le_totals[le] = le_totals.get(le, 0) + (line.total_payout or 0)

        payroll_by_department = [
            {"department": d, "total": t}
            for d, t in sorted(dept_totals.items(), key=lambda x: x[1], reverse=True)
        ]
        payroll_by_le = [
            {"legal_entity": le, "total": t}
            for le, t in sorted(le_totals.items(), key=lambda x: x[1], reverse=True)
        ]

    payroll_by_month = []
    prev_total = None
    payroll_growth = []
    for i in range(11, -1, -1):
        d = today.replace(day=1) - timedelta(days=i * 28)
        m, y = d.month, d.year
        period = PayrollPeriod.query.filter_by(month=m, year=y).first()
        month_total = 0
        month_fiat = 0
        month_crypto = 0
        if period:
            month_total = sum(l.total_payout or 0 for l in period.lines)
            month_fiat = sum(l.fiat_amount or 0 for l in period.lines)
            month_crypto = sum(l.crypto_amount or 0 for l in period.lines)

        label = f"{y}-{m:02d}"
        payroll_by_month.append({
            "month": m,
            "year": y,
            "label": label,
            "total": month_total,
            "fiat": month_fiat,
            "crypto": month_crypto,
        })

        growth_pct = None
        if prev_total is not None and prev_total > 0:
            growth_pct = round((month_total - prev_total) / prev_total * 100, 1)
        payroll_growth.append({
            "month": m,
            "year": y,
            "label": label,
            "total": month_total,
            "growth_pct": growth_pct,
        })
        prev_total = month_total

    top_departments = sorted(
        payroll_by_department, key=lambda x: x["total"], reverse=True
    )

    return jsonify({
        "total_payroll_this_month": total_payout,
        "total_crypto_payouts": total_crypto,
        "total_fiat_payouts": total_fiat,
        "active_employees": active_count,
        "inactive_employees": inactive_count,
        "pending_payments": pending_payments,
        "avg_salary_by_department": avg_salary_by_department,
        "payroll_by_department": payroll_by_department,
        "payroll_by_legal_entity": payroll_by_le,
        "crypto_vs_fiat": {"crypto": total_crypto, "fiat": total_fiat},
        "payroll_by_month": payroll_by_month,
        "top_departments": top_departments,
        "payroll_growth": payroll_growth,
    })
