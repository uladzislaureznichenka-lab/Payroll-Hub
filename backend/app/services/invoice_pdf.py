"""Invoice PDF generation via HTML template + Playwright (headless Chrome)."""
import os
from datetime import timedelta
from io import BytesIO

from app.models import Invoice, InvoiceTemplate, Employee, LegalEntity


def _get_default_template_path():
    # __file__ = app/services/invoice_pdf.py -> base = backend/
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "templates", "invoices", "invoice-template.html")


def get_default_template_html():
    """Return the default invoice template HTML content."""
    path = _get_default_template_path()
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _get_active_template():
    """Return the active HTML template or None to use default file."""
    t = InvoiceTemplate.query.filter_by(is_active=True).first()
    return t


def _invoice_to_template_data(inv, template_override=None):
    """Build template variables from Invoice model.
    template_override: optional InvoiceTemplate to use for header/company/payment fields.
    """
    emp = Employee.query.get(inv.employee_id)
    le = LegalEntity.query.get(inv.legal_entity_id) if inv.legal_entity_id else None
    template = template_override or (InvoiceTemplate.query.get(inv.template_id) if inv.template_id else None)

    company_name = (template.company_name if template and template.company_name else "Company") or "Company"
    company_details = (template.company_details if template and template.company_details else "") or company_name
    header = (template.header if template and template.header else "Invoice") or "Invoice"
    payment_instructions = (template.payment_instructions if template and template.payment_instructions else "") or ""

    worker_name = f"{emp.first_name} {emp.last_name}" if emp else "Worker"
    client_name = le.name if le else worker_name
    client_address = le.address if le and le.address else ""

    date_str = inv.date.strftime("%d/%m/%Y") if inv.date else ""
    due_date = (inv.date + timedelta(days=15)).strftime("%d/%m/%Y") if inv.date else ""

    period_label = f"{inv.period_year}-{inv.period_month:02d}"

    base_sal = inv.base_salary if inv.base_salary is not None else inv.amount
    bonus_val = inv.bonus or 0
    tax_reimb = inv.tax_reimbursement or 0
    has_breakdown = (inv.base_salary is not None) or bonus_val or tax_reimb

    def _row(desc, amt, qty=1):
        amt_fmt = f"{amt:,.2f}"
        total = amt * qty
        total_fmt = f"{total:,.2f}"
        return f'<tr><td>{desc}</td><td class="text-right">{amt_fmt}</td><td class="text-right">{qty}</td><td class="text-right">{total_fmt}</td></tr>'

    lines = []
    if has_breakdown:
        lines.append(_row("Base salary", base_sal))
        if bonus_val:
            lines.append(_row("Bonus", bonus_val))
        if tax_reimb:
            lines.append(_row("Tax reimbursement", tax_reimb))
    else:
        desc = inv.description or "Payroll services"
        lines.append(_row(desc, inv.amount))

    line_items = "\n".join(lines)
    total_amount = f"{inv.amount:,.2f}"

    payment_block = ""
    if payment_instructions:
        payment_block = f'<div class="payment-instructions"><h4>Payment Instructions</h4><pre>{payment_instructions}</pre></div>'

    return {
        "invoice_number": inv.invoice_number,
        "date": date_str,
        "due_date": due_date,
        "header": header,
        "company_details": company_details,
        "client_name": client_name,
        "client_address": client_address,
        "employee_name": worker_name,
        "period": period_label,
        "line_items": line_items,
        "total_amount": total_amount,
        "currency": inv.currency,
        "payment_instructions_block": payment_block,
    }


def _render_html(html_template, data):
    """Replace {{variable}} placeholders in template."""
    result = html_template
    for key, val in data.items():
        result = result.replace(f"{{{{{key}}}}}", str(val or ""))
    return result


def get_html_for_invoice(inv, template_override=None):
    """Return rendered HTML for an invoice (for preview or PDF).
    If template_override is provided (InvoiceTemplate), use its html_content.
    """
    if template_override and template_override.html_content:
        html_template = template_override.html_content
    else:
        active = _get_active_template()
        if active and active.html_content:
            html_template = active.html_content
        else:
            path = _get_default_template_path()
            with open(path, "r", encoding="utf-8") as f:
                html_template = f.read()

    data = _invoice_to_template_data(inv, template_override=template_override)
    return _render_html(html_template, data)


def get_html_for_template_preview(template_id=None):
    """Return HTML for template preview using sample invoice data."""
    inv = Invoice.query.first()
    if not inv:
        return None
    t = InvoiceTemplate.query.get(template_id) if template_id else None
    return get_html_for_invoice(inv, template_override=t)


def generate_invoice_pdf(inv):
    """Generate PDF from invoice using Playwright (if available). Returns BytesIO buffer."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise RuntimeError("Playwright not installed")

    try:
        html = get_html_for_invoice(inv)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "20mm", "right": "20mm", "bottom": "20mm", "left": "20mm"},
            )
            browser.close()
        buf = BytesIO(pdf_bytes)
        buf.seek(0)
        return buf
    except Exception:
        raise RuntimeError("Playwright/Chromium not available")
