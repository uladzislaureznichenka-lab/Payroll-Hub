"""Currency conversion service - fetches rates from APIs and converts to USDC."""
import os
import urllib.request
import json
from datetime import datetime
from app import db
from app.models import CurrencyConversionConfig, ExchangeRate

FIAT_CURRENCIES = {"EUR", "PLN", "BYN", "RUB", "USD", "GBP", "CHF"}
CRYPTO_USDC = {"USDC", "USDT"}  # 1:1 with USDC

DEFAULT_RATES = {
    "EUR": 0.92,
    "PLN": 0.24,
    "BYN": 0.31,
    "RUB": 0.011,
    "USD": 1.0,
    "GBP": 1.27,
    "CHF": 1.13,
}


def _get_config():
    return CurrencyConversionConfig.query.first()


def _get_rate_from_db(from_currency):
    r = ExchangeRate.query.filter_by(from_currency=from_currency.upper(), to_currency="USDC").first()
    return r.rate if r else None


def _save_rate(from_currency, rate):
    from_currency = from_currency.upper()
    r = ExchangeRate.query.filter_by(from_currency=from_currency, to_currency="USDC").first()
    if r:
        r.rate = rate
        r.updated_at = datetime.utcnow()
    else:
        db.session.add(ExchangeRate(from_currency=from_currency, to_currency="USDC", rate=rate))
    db.session.commit()


def _fetch_coingecko(api_key=None):
    """CoinGecko free API - no key needed for basic."""
    rates = {}
    try:
        url = "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether&vs_currencies=eur,pln,byn,rub,usd,gbp,chf"
        req = urllib.request.Request(url, headers={"User-Agent": "PayrollHub/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        usdc = data.get("usd-coin", {})
        usdt = data.get("tether", {})
        for cur in ["eur", "pln", "byn", "rub", "usd", "gbp", "chf"]:
            val = usdc.get(cur) or usdt.get(cur)
            if val:
                rates[cur.upper()] = 1.0 / val
    except Exception:
        pass
    return rates


def _fetch_exchangerate(api_key):
    if not api_key:
        return {}
    rates = {}
    try:
        url = f"https://v6.exchangerate-api.com/v6/{api_key}/latest/USD"
        req = urllib.request.Request(url, headers={"User-Agent": "PayrollHub/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        if data.get("result") == "success":
            conv = data.get("conversion_rates", {})
            for cur in FIAT_CURRENCIES:
                if cur in conv and conv.get("USD"):
                    rates[cur] = 1.0 / conv[cur]
    except Exception:
        pass
    return rates


def _fetch_openexchangerates(api_key):
    if not api_key:
        return {}
    rates = {}
    try:
        url = f"https://openexchangerates.org/api/latest.json?app_id={api_key}"
        req = urllib.request.Request(url, headers={"User-Agent": "PayrollHub/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        conv = data.get("rates", {})
        usd = conv.get("USD", 1)
        for cur in FIAT_CURRENCIES:
            if cur in conv and conv[cur]:
                rates[cur] = usd / conv[cur]
    except Exception:
        pass
    return rates


def fetch_rates(provider=None, api_key=None):
    """Fetch rates from provider and save to DB."""
    config = _get_config()
    if not config:
        from app import db
        config = CurrencyConversionConfig(provider="coingecko")
        db.session.add(config)
        db.session.commit()
    provider = provider or (config.provider if config else "coingecko")
    api_key = api_key or (config.api_key if config else None)

    if provider == "exchangerate":
        rates = _fetch_exchangerate(api_key)
    elif provider == "openexchangerates":
        rates = _fetch_openexchangerates(api_key)
    else:
        rates = _fetch_coingecko(api_key)

    for cur, rate in rates.items():
        _save_rate(cur, rate)
    _save_rate("USDC", 1.0)
    _save_rate("USDT", 1.0)
    return rates


def convert_to_usdc(amount, currency):
    """Convert amount to USDC. Crypto USDC/USDT = 1:1. Fiat uses rates."""
    if not amount or amount <= 0:
        return 0.0
    cur = (currency or "EUR").upper()
    if cur in CRYPTO_USDC:
        return round(float(amount), 2)
    rate = _get_rate_from_db(cur)
    if rate is None:
        rate = DEFAULT_RATES.get(cur, 0.92)
    return round(float(amount) * rate, 2)


def get_all_rates():
    """Return all cached rates."""
    rows = ExchangeRate.query.filter_by(to_currency="USDC").all()
    return {r.from_currency: {"rate": r.rate, "updated_at": r.updated_at.isoformat() if r.updated_at else None} for r in rows}


def test_connection(provider, api_key):
    """Test API connection. Returns (success, message). Does not save to DB."""
    try:
        if provider == "exchangerate":
            rates = _fetch_exchangerate(api_key)
        elif provider == "openexchangerates":
            rates = _fetch_openexchangerates(api_key)
        else:
            rates = _fetch_coingecko(api_key)
        if rates:
            return True, f"Connected. Fetched {len(rates)} rates."
        return False, "No rates returned. Check API key."
    except Exception as e:
        return False, str(e)
