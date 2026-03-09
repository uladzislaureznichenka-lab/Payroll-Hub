from datetime import date, datetime
from app import db
from app.models import User, Department, LegalEntity, Employee, InvoiceTemplate, CompensationHistory


def seed_data():
    if User.query.first():
        return

    admin = User(email="admin@payrollhub.com", name="Admin", role="admin")
    admin.set_password("admin123")
    db.session.add(admin)

    dept_names = [
        "Engineering", "Support", "Product", "Business Development",
        "HR", "Legal", "Finance", "Marketing",
    ]
    depts = {}
    for name in dept_names:
        d = Department(name=name)
        db.session.add(d)
        depts[name] = d

    le_data = [
        ("Chain Valley", "71 Cherry Court, London, UK", "CV-2024-001"),
        ("UTRG UAB", "Vilnius, Lithuania", "UTRG-304578912"),
        ("UTORG Labs", "Warsaw, Poland", "UL-2024-PL-003"),
    ]
    entities = {}
    for name, addr, reg in le_data:
        le = LegalEntity(name=name, address=addr, registration_number=reg)
        db.session.add(le)
        entities[name] = le

    db.session.flush()

    employees_data = [
        {
            "employee_id": "EMP-001", "first_name": "Alex", "last_name": "Johnson",
            "email": "alex.j@company.com", "country": "United Kingdom",
            "department": "Engineering", "job_title": "Senior Developer",
            "manager": "CTO", "employment_type": "Contractor",
            "legal_entity": "Chain Valley", "telegram": "@alexj",
            "slack": "alex.johnson", "start_date": date(2023, 3, 15),
            "base_salary": 5000, "salary_type": "Monthly", "currency": "EUR",
            "payment_method": "Fiat",
            "bank_name": "Revolut", "iban": "GB29NWBK60161331926819",
            "account_holder": "Alex Johnson",
        },
        {
            "employee_id": "EMP-002", "first_name": "Maria", "last_name": "Kowalski",
            "email": "maria.k@company.com", "country": "Poland",
            "department": "Product", "job_title": "Product Manager",
            "manager": "CPO", "employment_type": "Employee via agency",
            "legal_entity": "UTORG Labs", "telegram": "@mariak",
            "slack": "maria.kowalski", "start_date": date(2023, 6, 1),
            "base_salary": 4500, "salary_type": "Monthly", "currency": "PLN",
            "payment_method": "Fiat",
            "bank_name": "PKO BP", "iban": "PL61109010140000071219812874",
            "account_holder": "Maria Kowalski",
        },
        {
            "employee_id": "EMP-003", "first_name": "Dmitry", "last_name": "Petrov",
            "email": "dmitry.p@company.com", "country": "Lithuania",
            "department": "Engineering", "job_title": "Backend Developer",
            "manager": "Alex Johnson", "employment_type": "Contractor",
            "legal_entity": "UTRG UAB", "telegram": "@dmitryp",
            "slack": "dmitry.petrov", "start_date": date(2024, 1, 10),
            "base_salary": 4000, "salary_type": "Monthly", "currency": "EUR",
            "payment_method": "Crypto",
            "wallet_address": "TJfENbDhEWuVXjGMQvBmaBqaLJisNj3U21",
            "wallet_network": "TRON", "wallet_coin": "USDT",
        },
        {
            "employee_id": "EMP-004", "first_name": "Olena", "last_name": "Shevchenko",
            "email": "olena.s@company.com", "country": "Ukraine",
            "department": "Support", "job_title": "Support Lead",
            "manager": "HR Director", "employment_type": "Contractor via agency",
            "legal_entity": "Chain Valley", "telegram": "@olenas",
            "slack": "olena.shevchenko", "start_date": date(2023, 9, 1),
            "base_salary": 3000, "salary_type": "Monthly", "currency": "EUR",
            "payment_method": "Split",
            "bank_name": "Wise", "iban": "DE89370400440532013000",
            "account_holder": "Olena Shevchenko",
            "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
            "wallet_network": "ERC20", "wallet_coin": "USDC",
            "fiat_salary_amount": 1500, "crypto_salary_amount": 1500,
        },
        {
            "employee_id": "EMP-005", "first_name": "Jan", "last_name": "Novak",
            "email": "jan.n@company.com", "country": "Czech Republic",
            "department": "Business Development", "job_title": "BD Manager",
            "manager": "CEO", "employment_type": "Employee via agency",
            "legal_entity": "UTORG Labs", "telegram": "@jann",
            "slack": "jan.novak", "start_date": date(2024, 3, 1),
            "base_salary": 4200, "salary_type": "Monthly", "currency": "EUR",
            "payment_method": "Fiat",
            "bank_name": "Ceska Sporitelna", "iban": "CZ6508000000192000145399",
            "account_holder": "Jan Novak",
        },
        {
            "employee_id": "EMP-006", "first_name": "Sophie", "last_name": "Martin",
            "email": "sophie.m@company.com", "country": "France",
            "department": "Marketing", "job_title": "Marketing Lead",
            "manager": "CMO", "employment_type": "Contractor",
            "legal_entity": "Chain Valley", "telegram": "@sophiem",
            "slack": "sophie.martin", "start_date": date(2024, 6, 15),
            "base_salary": 45, "salary_type": "Hourly", "currency": "EUR",
            "payment_method": "Fiat",
            "bank_name": "BNP Paribas", "iban": "FR7630004000031234567890143",
            "account_holder": "Sophie Martin",
        },
        {
            "employee_id": "EMP-007", "first_name": "Viktor", "last_name": "Sokolov",
            "email": "viktor.s@company.com", "country": "Belarus",
            "department": "Engineering", "job_title": "Frontend Developer",
            "manager": "Alex Johnson", "employment_type": "Contractor",
            "legal_entity": "UTRG UAB", "telegram": "@viktors",
            "slack": "viktor.sokolov", "start_date": date(2024, 2, 1),
            "base_salary": 3500, "salary_type": "Monthly", "currency": "BYN",
            "payment_method": "Crypto",
            "wallet_address": "TN2YqTv2uBG9L1FQ6y5c8xHL6PK9NqL3U6",
            "wallet_network": "TRON", "wallet_coin": "USDT",
        },
        {
            "employee_id": "EMP-008", "first_name": "Anna", "last_name": "Müller",
            "email": "anna.m@company.com", "country": "Germany",
            "department": "HR", "job_title": "HR Manager",
            "manager": "CEO", "employment_type": "Employee via agency",
            "legal_entity": "UTORG Labs", "telegram": "@annam",
            "slack": "anna.mueller", "start_date": date(2023, 1, 15),
            "base_salary": 4800, "salary_type": "Monthly", "currency": "EUR",
            "payment_method": "Fiat",
            "bank_name": "Deutsche Bank", "iban": "DE89370400440532013001",
            "account_holder": "Anna Müller",
        },
        {
            "employee_id": "EMP-009", "first_name": "Andrei", "last_name": "Popov",
            "email": "andrei.p@company.com", "country": "Russia",
            "department": "Finance", "job_title": "Finance Analyst",
            "manager": "CFO", "employment_type": "Contractor",
            "legal_entity": "UTRG UAB", "telegram": "@andreip",
            "slack": "andrei.popov", "start_date": date(2024, 4, 1),
            "base_salary": 3800, "salary_type": "Monthly", "currency": "RUB",
            "payment_method": "Split",
            "bank_name": "Tinkoff", "iban": "RU0204452560040702810412345678901",
            "account_holder": "Andrei Popov",
            "wallet_address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            "wallet_network": "ERC20", "wallet_coin": "USDT",
            "fiat_salary_amount": 2000, "crypto_salary_amount": 1800,
        },
        {
            "employee_id": "EMP-010", "first_name": "Katya", "last_name": "Ivanova",
            "email": "katya.i@company.com", "country": "Lithuania",
            "department": "Legal", "job_title": "Legal Counsel",
            "manager": "CEO", "employment_type": "Contractor via agency",
            "legal_entity": "UTRG UAB", "telegram": "@katyai",
            "slack": "katya.ivanova", "start_date": date(2023, 11, 1),
            "base_salary": 5200, "salary_type": "Monthly", "currency": "EUR",
            "payment_method": "Fiat",
            "bank_name": "SEB", "iban": "LT121000011101001000",
            "account_holder": "Katya Ivanova",
        },
    ]

    for data in employees_data:
        dept_name = data.pop("department")
        le_name = data.pop("legal_entity")
        emp = Employee(
            department_id=depts[dept_name].id,
            legal_entity_id=entities[le_name].id,
            status="Active",
            **data,
        )
        db.session.add(emp)
        db.session.flush()
        db.session.add(
            CompensationHistory(
                employee_id=emp.id,
                effective_date=emp.start_date or date.today(),
                base_salary=emp.base_salary or 0,
                currency=emp.currency or "EUR",
                note="Initial salary",
                changed_by_user_id=None,
            )
        )

    # Employee portal users
    db.session.flush()
    emps = Employee.query.all()
    for emp in emps:
        if emp.email:
            portal_user = User(
                email=emp.email,
                name=f"{emp.first_name} {emp.last_name}",
                role="employee",
                employee_id=emp.id,
            )
            portal_user.set_password("employee123")
            db.session.add(portal_user)

    template = InvoiceTemplate(
        name="Default Template",
        header="INVOICE",
        company_name="UTORG Group",
        company_details="Vilnius, Lithuania\nReg: 304578912\nVAT: LT100011874413",
        payment_instructions="Payment due within 14 days of invoice date.",
    )
    db.session.add(template)

    db.session.commit()
    print("Database seeded with test data.")
