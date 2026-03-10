from datetime import datetime, date
from app import db
from werkzeug.security import generate_password_hash, check_password_hash


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default="admin")
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=True)
    reset_token = db.Column(db.String(255), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "employee_id": self.employee_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    employees = db.relationship("Employee", backref="department_rel", lazy=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}


class Currency(db.Model):
    __tablename__ = "currencies"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {"id": self.id, "code": self.code, "name": self.name or self.code}


class CurrencyConversionConfig(db.Model):
    __tablename__ = "currency_conversion_config"
    id = db.Column(db.Integer, primary_key=True)
    provider = db.Column(db.String(50), default="coingecko")
    api_key = db.Column(db.String(500), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExchangeRate(db.Model):
    __tablename__ = "exchange_rates"
    id = db.Column(db.Integer, primary_key=True)
    from_currency = db.Column(db.String(10), nullable=False)
    to_currency = db.Column(db.String(10), default="USDC")
    rate = db.Column(db.Float, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class CryptoNetwork(db.Model):
    __tablename__ = "crypto_networks"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name}


class LegalEntity(db.Model):
    __tablename__ = "legal_entities"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    address = db.Column(db.Text, nullable=True)
    registration_number = db.Column(db.String(100), nullable=True)
    employees = db.relationship("Employee", backref="legal_entity_rel", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "registration_number": self.registration_number,
        }


class Employee(db.Model):
    __tablename__ = "employees"
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(50), unique=True, nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    country = db.Column(db.String(100), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    job_title = db.Column(db.String(200), nullable=True)
    manager = db.Column(db.String(200), nullable=True)
    employment_type = db.Column(db.String(50), nullable=True)
    legal_entity_id = db.Column(db.Integer, db.ForeignKey("legal_entities.id"), nullable=True)
    telegram = db.Column(db.String(100), nullable=True)
    slack = db.Column(db.String(100), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default="Active")
    notes = db.Column(db.Text, nullable=True)
    internal_notes = db.Column(db.Text, nullable=True)

    # Salary
    base_salary = db.Column(db.Float, default=0)
    post_probation_salary = db.Column(db.Float, nullable=True)
    probation_end_date = db.Column(db.Date, nullable=True)
    salary_type = db.Column(db.String(20), default="Monthly")
    currency = db.Column(db.String(10), default="EUR")
    payment_method = db.Column(db.String(20), default="Fiat")

    # Bank details
    bank_name = db.Column(db.String(200), nullable=True)
    iban = db.Column(db.String(100), nullable=True)
    account_holder = db.Column(db.String(200), nullable=True)
    swift = db.Column(db.String(100), nullable=True)

    # Crypto details
    wallet_address = db.Column(db.String(255), nullable=True)
    wallet_network = db.Column(db.String(20), nullable=True)
    wallet_coin = db.Column(db.String(10), nullable=True)

    # Split payment amounts
    fiat_salary_amount = db.Column(db.Float, nullable=True)
    crypto_salary_amount = db.Column(db.Float, nullable=True)

    # Overtime
    overtime_rate = db.Column(db.Float, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    payroll_lines = db.relationship("PayrollLine", backref="employee", lazy=True)
    payments = db.relationship("Payment", backref="employee", lazy=True)
    invoices = db.relationship("Invoice", backref="employee", lazy=True)
    requests = db.relationship("Request", backref="employee", lazy=True)
    custom_field_values = db.relationship("CustomFieldValue", backref="employee", lazy=True)
    compensation_history = db.relationship(
        "CompensationHistory",
        backref="employee",
        lazy=True,
        cascade="all, delete-orphan",
    )

    @property
    def effective_salary(self):
        if (
            self.post_probation_salary
            and self.probation_end_date
            and date.today() >= self.probation_end_date
        ):
            return self.post_probation_salary
        return self.base_salary

    @property
    def department(self):
        return self.department_rel.name if self.department_rel else None

    @property
    def legal_entity(self):
        return self.legal_entity_rel.name if self.legal_entity_rel else None

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": f"{self.first_name} {self.last_name}",
            "email": self.email,
            "country": self.country,
            "department": self.department,
            "department_id": self.department_id,
            "job_title": self.job_title,
            "manager": self.manager,
            "employment_type": self.employment_type,
            "legal_entity": self.legal_entity,
            "legal_entity_id": self.legal_entity_id,
            "telegram": self.telegram,
            "slack": self.slack,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "status": self.status,
            "notes": self.notes,
            "internal_notes": self.internal_notes,
            "base_salary": self.base_salary,
            "post_probation_salary": self.post_probation_salary,
            "probation_end_date": self.probation_end_date.isoformat() if self.probation_end_date else None,
            "effective_salary": self.effective_salary,
            "salary_type": self.salary_type,
            "currency": self.currency,
            "payment_method": self.payment_method,
            "bank_name": self.bank_name,
            "iban": self.iban,
            "account_holder": self.account_holder,
            "swift": self.swift,
            "wallet_address": self.wallet_address,
            "wallet_network": self.wallet_network,
            "wallet_coin": self.wallet_coin,
            "fiat_salary_amount": self.fiat_salary_amount,
            "crypto_salary_amount": self.crypto_salary_amount,
            "overtime_rate": self.overtime_rate,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PayrollPeriod(db.Model):
    __tablename__ = "payroll_periods"
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default="Draft")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    finalized_at = db.Column(db.DateTime, nullable=True)
    lines = db.relationship("PayrollLine", backref="payroll_period", lazy=True, cascade="all, delete-orphan")

    __table_args__ = (db.UniqueConstraint("month", "year", name="uq_payroll_month_year"),)

    def to_dict(self):
        return {
            "id": self.id,
            "month": self.month,
            "year": self.year,
            "period_label": f"{self.year}-{self.month:02d}",
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "finalized_at": self.finalized_at.isoformat() if self.finalized_at else None,
            "total_payout": sum(l.total_payout or 0 for l in self.lines),
            "total_fiat": sum(l.fiat_amount or 0 for l in self.lines),
            "total_crypto": sum(l.crypto_amount or 0 for l in self.lines),
            "employee_count": len(self.lines),
        }


class PayrollLine(db.Model):
    __tablename__ = "payroll_lines"
    id = db.Column(db.Integer, primary_key=True)
    payroll_period_id = db.Column(db.Integer, db.ForeignKey("payroll_periods.id"), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    base_salary = db.Column(db.Float, default=0)
    bonus = db.Column(db.Float, default=0)
    bonus_comment = db.Column(db.Text, nullable=True)
    penalties = db.Column(db.Float, default=0)
    penalties_comment = db.Column(db.Text, nullable=True)
    adjustments = db.Column(db.Float, default=0)
    adjustments_comment = db.Column(db.Text, nullable=True)
    reimbursements = db.Column(db.Float, default=0)
    tax_reimbursement_type = db.Column(db.String(20), nullable=True)  # percent | fixed
    tax_reimbursement_percent = db.Column(db.Float, default=0)
    tax_reimbursement_fixed = db.Column(db.Float, default=0)
    tax_reimbursement_amount = db.Column(db.Float, default=0)
    tax_reimbursement_comment = db.Column(db.Text, nullable=True)
    overtime_hours = db.Column(db.Float, default=0)
    overtime_rate = db.Column(db.Float, default=0)
    overtime_payout = db.Column(db.Float, default=0)
    hourly_hours = db.Column(db.Float, nullable=True)
    working_days_total = db.Column(db.Integer, nullable=True)
    working_days_worked = db.Column(db.Integer, nullable=True)
    prorated_salary = db.Column(db.Float, nullable=True)
    fiat_amount = db.Column(db.Float, default=0)
    crypto_amount = db.Column(db.Float, default=0)
    total_payout = db.Column(db.Float, default=0)
    currency = db.Column(db.String(10), default="EUR")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    payments = db.relationship("Payment", backref="payroll_line", lazy=True)

    def to_dict(self):
        emp = Employee.query.get(self.employee_id)
        pending_requests = Request.query.filter_by(
            employee_id=self.employee_id, status="Open"
        ).all()
        return {
            "id": self.id,
            "payroll_period_id": self.payroll_period_id,
            "employee_id": self.employee_id,
            "employee_name": emp.first_name + " " + emp.last_name if emp else "",
            "employee_eid": emp.employee_id if emp else "",
            "department": emp.department if emp else "",
            "employment_type": emp.employment_type if emp else "",
            "salary_type": emp.salary_type if emp else "",
            "payment_method": emp.payment_method if emp else "",
            "base_salary": self.base_salary,
            "bonus": self.bonus,
            "bonus_comment": self.bonus_comment,
            "penalties": self.penalties,
            "penalties_comment": self.penalties_comment,
            "adjustments": self.adjustments,
            "adjustments_comment": self.adjustments_comment,
            "reimbursements": self.reimbursements,
            "tax_reimbursement_type": self.tax_reimbursement_type,
            "tax_reimbursement_percent": self.tax_reimbursement_percent,
            "tax_reimbursement_fixed": self.tax_reimbursement_fixed,
            "tax_reimbursement_amount": self.tax_reimbursement_amount,
            "tax_reimbursement_comment": self.tax_reimbursement_comment,
            "overtime_hours": self.overtime_hours,
            "overtime_rate": self.overtime_rate,
            "overtime_payout": self.overtime_payout,
            "hourly_hours": self.hourly_hours,
            "working_days_total": self.working_days_total,
            "working_days_worked": self.working_days_worked,
            "prorated_salary": self.prorated_salary,
            "fiat_amount": self.fiat_amount,
            "crypto_amount": self.crypto_amount,
            "total_payout": self.total_payout,
            "currency": self.currency,
            "pending_requests": [r.to_dict_brief() for r in pending_requests],
        }


class Payment(db.Model):
    __tablename__ = "payments"
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    payroll_line_id = db.Column(db.Integer, db.ForeignKey("payroll_lines.id"), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), nullable=False)
    payment_type = db.Column(db.String(20), nullable=False)
    payment_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default="Pending")

    # Crypto details
    network = db.Column(db.String(20), nullable=True)
    wallet_address = db.Column(db.String(255), nullable=True)
    coin = db.Column(db.String(10), nullable=True)
    tx_hash = db.Column(db.String(255), nullable=True)

    # Fiat details
    bank_name = db.Column(db.String(200), nullable=True)
    iban = db.Column(db.String(100), nullable=True)
    account_holder = db.Column(db.String(200), nullable=True)
    swift = db.Column(db.String(100), nullable=True)

    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_explorer_url(self):
        if not self.tx_hash:
            return None
        if self.network == "TRON":
            return f"https://tronscan.org/#/transaction/{self.tx_hash}"
        if self.network == "ERC20":
            return f"https://etherscan.io/tx/{self.tx_hash}"
        return None

    def to_dict(self):
        emp = Employee.query.get(self.employee_id)
        payroll_line = PayrollLine.query.get(self.payroll_line_id) if self.payroll_line_id else None
        payroll_period = payroll_line.payroll_period if payroll_line else None
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "",
            "employee_eid": emp.employee_id if emp else "",
            "payroll_line_id": self.payroll_line_id,
            "payroll_period_month": payroll_period.month if payroll_period else None,
            "payroll_period_year": payroll_period.year if payroll_period else None,
            "payroll_period_label": f"{payroll_period.year}-{payroll_period.month:02d}" if payroll_period else None,
            "amount": self.amount,
            "currency": self.currency,
            "payment_type": self.payment_type,
            "payment_date": self.payment_date.isoformat() if self.payment_date else None,
            "status": self.status,
            "network": self.network,
            "wallet_address": self.wallet_address,
            "coin": self.coin,
            "tx_hash": self.tx_hash,
            "explorer_url": self.get_explorer_url(),
            "bank_name": self.bank_name,
            "iban": self.iban,
            "account_holder": self.account_holder,
            "swift": self.swift,
            "base_salary": payroll_line.prorated_salary if payroll_line else None,
            "bonus": payroll_line.bonus if payroll_line else None,
            "tax_reimbursement_amount": payroll_line.tax_reimbursement_amount if payroll_line else None,
            "total_payout": payroll_line.total_payout if payroll_line else self.amount,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Invoice(db.Model):
    __tablename__ = "invoices"
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(100), unique=True, nullable=False)
    date = db.Column(db.Date, default=date.today)
    legal_entity_id = db.Column(db.Integer, db.ForeignKey("legal_entities.id"), nullable=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    period_month = db.Column(db.Integer, nullable=False)
    period_year = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), nullable=False)
    base_salary = db.Column(db.Float, nullable=True)
    bonus = db.Column(db.Float, nullable=True)
    tax_reimbursement = db.Column(db.Float, nullable=True)
    description = db.Column(db.Text, nullable=True)
    template_id = db.Column(db.Integer, db.ForeignKey("invoice_templates.id"), nullable=True)
    pdf_path = db.Column(db.String(500), nullable=True)
    uploaded_pdf_path = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        emp = Employee.query.get(self.employee_id)
        le = LegalEntity.query.get(self.legal_entity_id) if self.legal_entity_id else None
        return {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "date": self.date.isoformat() if self.date else None,
            "legal_entity": le.name if le else "",
            "legal_entity_id": self.legal_entity_id,
            "employee_id": self.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "",
            "period_month": self.period_month,
            "period_year": self.period_year,
            "period_label": f"{self.period_year}-{self.period_month:02d}",
            "amount": self.amount,
            "currency": self.currency,
            "base_salary": self.base_salary,
            "bonus": self.bonus,
            "tax_reimbursement": self.tax_reimbursement,
            "description": self.description,
            "template_id": self.template_id,
            "has_pdf": bool(self.pdf_path),
            "has_uploaded_pdf": bool(self.uploaded_pdf_path),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class InvoiceTemplate(db.Model):
    __tablename__ = "invoice_templates"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    header = db.Column(db.String(500), nullable=True)
    company_name = db.Column(db.String(200), nullable=True)
    company_details = db.Column(db.Text, nullable=True)
    payment_instructions = db.Column(db.Text, nullable=True)
    template_pdf_path = db.Column(db.String(500), nullable=True)
    html_content = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "header": self.header,
            "company_name": self.company_name,
            "company_details": self.company_details,
            "payment_instructions": self.payment_instructions,
            "has_template_pdf": bool(self.template_pdf_path),
            "html_content": self.html_content,
            "is_active": bool(self.is_active),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Request(db.Model):
    __tablename__ = "requests"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(300), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    description = db.Column(db.Text, nullable=True)
    request_type = db.Column(db.String(50), nullable=False)
    requested_by = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(20), default="Open")
    amount = db.Column(db.Float, nullable=True)
    currency = db.Column(db.String(10), nullable=True)
    attachment_path = db.Column(db.String(500), nullable=True)
    comment = db.Column(db.Text, nullable=True)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        emp = Employee.query.get(self.employee_id)
        return {
            "id": self.id,
            "title": self.title,
            "employee_id": self.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "",
            "description": self.description,
            "request_type": self.request_type,
            "requested_by": self.requested_by,
            "status": self.status,
            "amount": self.amount,
            "currency": self.currency,
            "has_attachment": bool(self.attachment_path),
            "comment": self.comment,
            "date_created": self.date_created.isoformat() if self.date_created else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_dict_brief(self):
        return {
            "id": self.id,
            "title": self.title,
            "request_type": self.request_type,
            "status": self.status,
            "amount": self.amount,
        }


class CompensationHistory(db.Model):
    __tablename__ = "compensation_history"
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    effective_date = db.Column(db.Date, nullable=False, default=date.today)
    base_salary = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), nullable=False, default="EUR")
    note = db.Column(db.Text, nullable=True)
    changed_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        def _date_str(d):
            if d is None:
                return None
            return d.isoformat() if hasattr(d, "isoformat") else str(d)

        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "effective_date": _date_str(self.effective_date),
            "base_salary": float(self.base_salary or 0),
            "currency": self.currency or "EUR",
            "note": self.note,
            "changed_by_user_id": self.changed_by_user_id,
            "created_at": _date_str(self.created_at),
        }


class PayoutAuditLog(db.Model):
    __tablename__ = "payout_audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    field_changed = db.Column(db.String(50), nullable=False)
    old_value = db.Column(db.Text, nullable=True)
    new_value = db.Column(db.Text, nullable=True)
    changed_by = db.Column(db.String(200), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        ts = self.timestamp
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "field_changed": self.field_changed,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "changed_by": self.changed_by,
            "timestamp": ts.isoformat() if ts and hasattr(ts, "isoformat") else (str(ts) if ts else None),
        }


class CustomField(db.Model):
    __tablename__ = "custom_fields"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    field_type = db.Column(db.String(50), default="text")
    required = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "field_type": self.field_type,
            "required": self.required,
        }


class CustomFieldValue(db.Model):
    __tablename__ = "custom_field_values"
    id = db.Column(db.Integer, primary_key=True)
    custom_field_id = db.Column(db.Integer, db.ForeignKey("custom_fields.id"), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    value = db.Column(db.Text, nullable=True)

    field = db.relationship("CustomField", backref="values")

    def to_dict(self):
        f = self.field
        return {
            "id": self.id,
            "field_name": f.name if f else "",
            "field_type": getattr(f, "field_type", "text") if f else "text",
            "value": self.value or "",
        }
