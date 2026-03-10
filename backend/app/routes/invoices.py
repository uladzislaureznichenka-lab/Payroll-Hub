import csv
import io
import os
from datetime import date, datetime, timedelta

from flask import Blueprint, request, jsonify, Response, send_file, current_app
from flask_jwt_extended import jwt_required
from fpdf import FPDF
from io import BytesIO

from app import db
from app.models import (
    Invoice, InvoiceTemplate, Employee, LegalEntity,
    PayrollPeriod, PayrollLine,
)
from app.services.invoice_pdf import (
    generate_invoice_pdf,
    get_html_for_invoice,
    get_html_for_template_preview,
    get_default_template_html,
)

invoices_bp = Blueprint("invoices", __name__)


def _generate_invoice_number(legal_entity_id, period_month, period_year):
    entity_code = "INV"
    if legal_entity_id:
        le = LegalEntity.query.get(legal_entity_id)
        if le:
            entity_code = "".join(w[0].upper() for w in le.name.split() if w)

    period_str = f"{period_year}{period_month:02d}"
    prefix = f"{entity_code}-{period_str}-"

    last = (
        Invoice.query
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(Invoice.id.desc())
        .first()
    )

    seq = 1
    if last:
        try:
            seq = int(last.invoice_number.split("-")[-1]) + 1
        except ValueError:
            seq = 1

    return f"{prefix}{seq:04d}"


@invoices_bp.route("/", methods=["GET"])
@jwt_required()
def list_invoices():
    q = Invoice.query

    for param, col in [
        ("employee_id", Invoice.employee_id),
        ("legal_entity_id", Invoice.legal_entity_id),
        ("period_month", Invoice.period_month),
        ("period_year", Invoice.period_year),
    ]:
        val = request.args.get(param)
        if val:
            q = q.filter(col == int(val))

    invoices = q.order_by(Invoice.created_at.desc()).all()
    return jsonify([inv.to_dict() for inv in invoices])


@invoices_bp.route("/batch-delete", methods=["POST"])
@jwt_required()
def batch_delete_invoices():
    data = request.get_json() or {}
    ids = data.get("ids", [])
    if not ids:
        return jsonify({"error": "ids required"}), 400
    deleted = 0
    for iid in ids:
        inv = Invoice.query.get(iid)
        if inv:
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
            deleted += 1
    db.session.commit()
    return jsonify({"deleted": deleted})


@invoices_bp.route("/delete-all", methods=["POST"])
@jwt_required()
def delete_all_invoices():
    invoices = Invoice.query.all()
    for inv in invoices:
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
    deleted = Invoice.query.delete()
    db.session.commit()
    return jsonify({"deleted": deleted})


@invoices_bp.route("/<int:id>", methods=["GET"])
@jwt_required()
def get_invoice(id):
    inv = Invoice.query.get_or_404(id)
    return jsonify(inv.to_dict())


@invoices_bp.route("/", methods=["POST"])
@jwt_required()
def create_invoice():
    data = request.get_json() or {}
    employee_id = data.get("employee_id")
    if not employee_id:
        return jsonify({"error": "employee_id is required"}), 400
    try:
        employee_id = int(employee_id)
    except (TypeError, ValueError):
        return jsonify({"error": "employee_id must be a valid number"}), 400
    legal_entity_id = data.get("legal_entity_id")
    if legal_entity_id is not None and legal_entity_id != "":
        try:
            legal_entity_id = int(legal_entity_id)
        except (TypeError, ValueError):
            legal_entity_id = None
    else:
        legal_entity_id = None
    try:
        period_month = int(data.get("period_month") or 0)
        period_year = int(data.get("period_year") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "period_month and period_year must be valid numbers"}), 400
    if not 1 <= period_month <= 12:
        return jsonify({"error": "period_month must be between 1 and 12"}), 400
    if period_year < 2000 or period_year > 2100:
        return jsonify({"error": "period_year must be between 2000 and 2100"}), 400
    try:
        amount = float(data.get("amount") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a valid number"}), 400
    if amount < 0:
        return jsonify({"error": "amount must be non-negative"}), 400

    emp = Employee.query.get(employee_id)
    if not emp:
        return jsonify({"error": "Employee not found"}), 404

    inv = Invoice(
        invoice_number=_generate_invoice_number(legal_entity_id, period_month, period_year),
        employee_id=employee_id,
        legal_entity_id=legal_entity_id,
        period_month=period_month,
        period_year=period_year,
        amount=amount,
        currency=data.get("currency", "EUR"),
        base_salary=data.get("base_salary"),
        bonus=data.get("bonus"),
        tax_reimbursement=data.get("tax_reimbursement"),
        description=data.get("description"),
        template_id=data.get("template_id"),
    )
    db.session.add(inv)
    db.session.commit()
    return jsonify(inv.to_dict()), 201


@invoices_bp.route("/generate-from-payroll", methods=["POST"])
@jwt_required()
def generate_from_payroll():
    data = request.get_json()
    period = PayrollPeriod.query.get_or_404(data["payroll_period_id"])
    created = []

    for line in period.lines:
        emp = Employee.query.get(line.employee_id)
        if not emp:
            continue
        inv = Invoice(
            invoice_number=_generate_invoice_number(
                emp.legal_entity_id, period.month, period.year
            ),
            employee_id=emp.id,
            legal_entity_id=emp.legal_entity_id,
            period_month=period.month,
            period_year=period.year,
            amount=line.total_payout,
            currency=line.currency,
            base_salary=line.prorated_salary,
            bonus=line.bonus,
            tax_reimbursement=line.tax_reimbursement_amount,
            description=f"Payroll {period.year}-{period.month:02d}",
        )
        db.session.add(inv)
        created.append(inv)

    db.session.commit()
    return jsonify({"created": len(created), "invoices": [i.to_dict() for i in created]}), 201


def _build_pdf_fallback(inv):
    """Fallback FPDF generation when Playwright is unavailable."""
    emp = Employee.query.get(inv.employee_id)
    le = LegalEntity.query.get(inv.legal_entity_id) if inv.legal_entity_id else None
    template = InvoiceTemplate.query.get(inv.template_id) if inv.template_id else None

    company_name = template.company_name if template and template.company_name else "Company"
    worker_name = f"{emp.first_name} {emp.last_name}" if emp else "Worker"
    period_label = f"{inv.period_year}-{inv.period_month:02d}"
    date_str = inv.date.strftime("%d/%m/%Y") if inv.date else ""
    due_date = (inv.date + timedelta(days=15)).strftime("%d/%m/%Y") if inv.date else ""

    base_sal = inv.base_salary if inv.base_salary is not None else inv.amount
    bonus_val = inv.bonus or 0
    tax_reimb = inv.tax_reimbursement or 0
    has_breakdown = (inv.base_salary is not None) or bonus_val or tax_reimb

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    header = template.header if template and template.header else "Invoice"
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, header, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(60, 6, "INVOICE NUMBER", border=0)
    pdf.cell(60, 6, "DATE OF ISSUE", border=0)
    pdf.cell(60, 6, "DUE DATE", border=0)
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(60, 6, inv.invoice_number, border=0)
    pdf.cell(60, 6, date_str, border=0)
    pdf.cell(60, 6, due_date, border=0)
    pdf.ln(8)

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(60, 6, "BILLED TO", border=0)
    pdf.cell(60, 6, "FROM", border=0)
    pdf.cell(60, 6, "PURCHASE ORDER", border=0)
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    billed_to = le.name if le else worker_name
    pdf.cell(60, 6, billed_to[:50], border=0)
    pdf.cell(60, 6, company_name[:50], border=0)
    pdf.cell(60, 6, period_label, border=0)
    pdf.ln(8)

    col_w = [90, 35, 25, 40]
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(col_w[0], 7, "Description", border=1)
    pdf.cell(col_w[1], 7, "Unit cost", border=1)
    pdf.cell(col_w[2], 7, "QTY", border=1)
    pdf.cell(col_w[3], 7, "Amount", border=1)
    pdf.ln(7)
    pdf.set_font("Helvetica", "", 10)

    def _row(desc, amt, qty=1):
        pdf.cell(col_w[0], 6, desc[:45], border=1)
        pdf.cell(col_w[1], 6, f"{amt:,.2f}", border=1)
        pdf.cell(col_w[2], 6, str(qty), border=1)
        pdf.cell(col_w[3], 6, f"{amt * qty:,.2f}", border=1)
        pdf.ln(6)

    if has_breakdown:
        _row("Base salary", base_sal)
        if bonus_val:
            _row("Bonus", bonus_val)
        if tax_reimb:
            _row("Tax reimbursement", tax_reimb)
    else:
        _row(inv.description or "Payroll services", inv.amount)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(150, 6, "INVOICE TOTAL", border=0)
    pdf.cell(40, 6, f"{inv.currency} {inv.amount:,.2f}", border=0)
    pdf.ln(8)

    if template and template.payment_instructions:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 6, "Payment Instructions:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for line in template.payment_instructions.split("\n"):
            pdf.cell(0, 5, line.strip(), new_x="LMARGIN", new_y="NEXT")

    buf = BytesIO()
    buf.write(pdf.output())
    buf.seek(0)
    return buf


def _build_pdf(inv):
    """Generate invoice PDF via HTML template + Playwright, fallback to FPDF."""
    try:
        return generate_invoice_pdf(inv)
    except Exception:
        return _build_pdf_fallback(inv)


@invoices_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_pdf():
    """Generate PDF for an invoice, save to disk, return download URL."""
    data = request.get_json() or {}
    invoice_id = data.get("invoice_id") or data.get("id")
    if not invoice_id:
        return jsonify({"error": "invoice_id is required"}), 400
    inv = Invoice.query.get_or_404(invoice_id)
    buf = _build_pdf(inv)
    upload_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], "invoices")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"invoice_{inv.invoice_number}.pdf"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(buf.read())
    inv.pdf_path = filepath
    db.session.commit()
    return jsonify({
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "pdf_path": filepath,
        "download_url": f"/api/invoices/{inv.id}/download-pdf",
    })


@invoices_bp.route("/<int:id>/preview-html", methods=["GET"])
@jwt_required()
def preview_html(id):
    """Return rendered HTML for invoice preview."""
    inv = Invoice.query.get_or_404(id)
    html = get_html_for_invoice(inv)
    return Response(html, mimetype="text/html")


@invoices_bp.route("/<int:id>/download-pdf", methods=["GET"])
@jwt_required()
def download_pdf(id):
    inv = Invoice.query.get_or_404(id)
    if inv.pdf_path and os.path.exists(inv.pdf_path):
        return send_file(
            inv.pdf_path,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"invoice_{inv.invoice_number}.pdf",
        )
    buf = _build_pdf(inv)
    return send_file(
        buf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"invoice_{inv.invoice_number}.pdf",
    )


@invoices_bp.route("/<int:id>/upload-pdf", methods=["POST"])
@jwt_required()
def upload_pdf(id):
    inv = Invoice.query.get_or_404(id)
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    upload_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], "invoices")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"invoice_{inv.id}_{file.filename}"
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    inv.uploaded_pdf_path = filepath
    db.session.commit()
    return jsonify(inv.to_dict())


@invoices_bp.route("/<int:id>/download-uploaded", methods=["GET"])
@jwt_required()
def download_uploaded(id):
    inv = Invoice.query.get_or_404(id)
    if not inv.uploaded_pdf_path or not os.path.exists(inv.uploaded_pdf_path):
        return jsonify({"error": "No uploaded PDF"}), 404
    return send_file(inv.uploaded_pdf_path, as_attachment=True)


@invoices_bp.route("/templates/default-html", methods=["GET"])
@jwt_required()
def get_default_template():
    """Return the default invoice template HTML for editing."""
    return jsonify({"html": get_default_template_html()})


@invoices_bp.route("/templates", methods=["GET"])
@jwt_required()
def list_templates():
    templates = InvoiceTemplate.query.order_by(InvoiceTemplate.name).all()
    return jsonify([t.to_dict() for t in templates])


@invoices_bp.route("/templates", methods=["POST"])
@jwt_required()
def create_template():
    data = request.get_json() or {}
    t = InvoiceTemplate(
        name=data.get("name", "New Template"),
        header=data.get("header"),
        company_name=data.get("company_name"),
        company_details=data.get("company_details"),
        payment_instructions=data.get("payment_instructions"),
        html_content=data.get("html_content"),
        is_active=False,
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@invoices_bp.route("/templates/<int:id>", methods=["PUT"])
@jwt_required()
def update_template(id):
    t = InvoiceTemplate.query.get_or_404(id)
    data = request.get_json() or {}
    for field in ("name", "header", "company_name", "company_details", "payment_instructions", "html_content"):
        if field in data:
            setattr(t, field, data[field])
    if "is_active" in data:
        if data["is_active"]:
            InvoiceTemplate.query.filter(InvoiceTemplate.id != id).update({"is_active": False})
        t.is_active = bool(data["is_active"])
    db.session.commit()
    return jsonify(t.to_dict())


@invoices_bp.route("/templates/<int:id>/preview-html", methods=["GET"])
@jwt_required()
def preview_template_html(id):
    """Preview template HTML with sample invoice data."""
    html = get_html_for_template_preview(template_id=id)
    if not html:
        return jsonify({"error": "No invoices exist for preview"}), 404
    return Response(html, mimetype="text/html")


@invoices_bp.route("/templates/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_template(id):
    t = InvoiceTemplate.query.get_or_404(id)
    db.session.delete(t)
    db.session.commit()
    return jsonify({"deleted": id})


@invoices_bp.route("/templates/<int:id>/set-active", methods=["POST"])
@jwt_required()
def set_active_template(id):
    t = InvoiceTemplate.query.get_or_404(id)
    InvoiceTemplate.query.filter(InvoiceTemplate.id != id).update({"is_active": False})
    t.is_active = True
    db.session.commit()
    return jsonify(t.to_dict())


@invoices_bp.route("/templates/<int:id>/upload-pdf", methods=["POST"])
@jwt_required()
def upload_template_pdf(id):
    """Upload a PDF template for invoice generation. Layout is used as reference."""
    t = InvoiceTemplate.query.get_or_404(id)
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    upload_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], "invoice_templates")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"template_{t.id}_{file.filename}"
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    t.template_pdf_path = filepath
    db.session.commit()
    return jsonify(t.to_dict())


EXPORT_COLUMNS = [
    "id", "invoice_number", "date", "legal_entity", "employee_name",
    "period_label", "amount", "currency", "description",
]


@invoices_bp.route("/export", methods=["GET"])
@jwt_required()
def export_csv():
    q = Invoice.query
    for param, col in [
        ("employee_id", Invoice.employee_id),
        ("legal_entity_id", Invoice.legal_entity_id),
        ("period_month", Invoice.period_month),
        ("period_year", Invoice.period_year),
    ]:
        val = request.args.get(param)
        if val:
            q = q.filter(col == int(val))

    invoices = q.order_by(Invoice.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=EXPORT_COLUMNS)
    writer.writeheader()
    for inv in invoices:
        d = inv.to_dict()
        writer.writerow({col: d.get(col, "") for col in EXPORT_COLUMNS})

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=invoices.csv"},
    )
