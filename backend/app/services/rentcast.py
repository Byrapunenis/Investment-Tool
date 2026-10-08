import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.models.property import MarketDataCache

RENTCAST_BASE_URL = "https://api.rentcast.io/v1"


class RentCastError(Exception):
    pass


def _address_key(address: str, city: str, state: str, zip_code: str) -> str:
    return f"{address}|{city}|{state}|{zip_code}".strip().lower()


def get_market_data(
    session: Session, address: str, city: str, state: str, zip_code: str
) -> dict:
    """Fetch value + rent estimates for an address, using a 7-day SQLite cache
    so repeat lookups don't spend RentCast free-tier calls."""
    key = _address_key(address, city, state, zip_code)
    cached = session.exec(
        select(MarketDataCache).where(MarketDataCache.address_key == key)
    ).first()

    if cached and cached.fetched_at > datetime.now(timezone.utc) - timedelta(
        days=settings.cache_ttl_days
    ):
        return {
            "value_estimate": cached.value_estimate,
            "rent_estimate": cached.rent_estimate,
            "source": "cache",
        }

    if not settings.rentcast_enabled:
        raise RentCastError(
            "RENTCAST_API_KEY is not set. Add it to backend/.env or enter "
            "value/rent estimates manually."
        )

    full_address = f"{address}, {city}, {state} {zip_code}"
    headers = {"X-Api-Key": settings.rentcast_api_key, "accept": "application/json"}

    value_estimate: Optional[float] = None
    rent_estimate: Optional[float] = None
    raw: dict = {}

    with httpx.Client(base_url=RENTCAST_BASE_URL, headers=headers, timeout=15.0) as client:
        avm_resp = client.get(
            "/avm/value", params={"address": full_address}
        )
        if avm_resp.status_code == 200:
            data = avm_resp.json()
            value_estimate = data.get("price")
            raw["value"] = data
        elif avm_resp.status_code not in (404, 400):
            raise RentCastError(f"RentCast value lookup failed: {avm_resp.status_code} {avm_resp.text}")

        rent_resp = client.get(
            "/avm/rent/long-term", params={"address": full_address}
        )
        if rent_resp.status_code == 200:
            data = rent_resp.json()
            rent_estimate = data.get("rent")
            raw["rent"] = data
        elif rent_resp.status_code not in (404, 400):
            raise RentCastError(f"RentCast rent lookup failed: {rent_resp.status_code} {rent_resp.text}")

    if cached:
        cached.value_estimate = value_estimate
        cached.rent_estimate = rent_estimate
        cached.raw_response = json.dumps(raw)
        cached.fetched_at = datetime.now(timezone.utc)
        session.add(cached)
    else:
        cached = MarketDataCache(
            address_key=key,
            value_estimate=value_estimate,
            rent_estimate=rent_estimate,
            raw_response=json.dumps(raw),
        )
        session.add(cached)
    session.commit()

    return {"value_estimate": value_estimate, "rent_estimate": rent_estimate, "source": "rentcast"}
