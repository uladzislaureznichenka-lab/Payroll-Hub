# Payroll Hub

Internal web-based payroll management platform for HR and Finance teams. Manages salary payments for employees across multiple countries using both fiat and cryptocurrency.

## Tech Stack

- **Backend**: Python Flask, SQLAlchemy, SQLite, Flask-JWT-Extended
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts
- **PDF Generation**: ReportLab

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Backend runs at http://localhost:5001

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173 (proxies API calls to backend)

## Default Credentials

| Role     | Email                  | Password     |
|----------|------------------------|--------------|
| Admin    | admin@payrollhub.com   | admin123     |
| Employee | alex.j@company.com     | employee123  |

## Seed Data

On first launch, the system automatically creates:
- 1 admin user
- 10 test employees across different departments, countries, and payment methods
- 3 legal entities (Chain Valley, UTRG UAB, UTORG Labs)
- 8 departments
- 1 default invoice template
- Employee portal accounts for all test employees

## Features

- **Dashboard** — KPI metrics, payroll charts, crypto vs fiat distribution
- **Employees** — CRUD, CSV import/export, salary management, probation tracking
- **Payroll** — Monthly payroll generation, prorated salary, split payments, overtime
- **Payments** — Fiat & crypto payment tracking, blockchain explorer links, TX hashes
- **Invoices** — Auto-generation, PDF download, custom templates, file upload
- **Requests** — Internal task system for bonuses, adjustments, reimbursements
- **Reports** — Department analytics, payroll trends, salary distribution
- **Settings** — Departments, legal entities, users, custom fields, invite system
- **Employee Portal** — Self-service view for salary, payments, invoices, reimbursements
