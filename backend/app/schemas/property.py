from datetime import date
from typing import Optional

from pydantic import BaseModel


class TenantCreate(BaseModel):
    label: Optional[str] = None
    monthly_rent: float


class PropertyCreate(BaseModel):
    address: str
    city: str
    state: str
    zip_code: str

    beds: Optional[float] = None
    baths: Optional[float] = None
    sqft: Optional[float] = None
    year_built: Optional[int] = None

    price: float
    estimated_value: Optional[float] = None
    estimated_rent: Optional[float] = None
    # When set (non-empty), estimated_rent is derived as the sum of these
    # instead of being entered directly — one row per tenant/unit.
    tenants: Optional[list[TenantCreate]] = None

    property_tax_annual: float = 0
    insurance_annual: float = 0
    hoa_monthly: float = 0
    maintenance_pct_of_rent: float = 0.0
    vacancy_pct_of_rent: float = 0.0
    management_pct_of_rent: float = 0.0

    down_payment_pct: float = 0.20
    interest_rate: float = 0.065
    loan_term_years: int = 30
    closing_costs: float = 0
    purchase_date: Optional[date] = None

    annual_appreciation_pct: float = 0.03
    annual_rent_growth_pct: float = 0.03
    hold_period_years: int = 10

    auto_fetch_market_data: bool = False


class PropertyUpdate(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None

    beds: Optional[float] = None
    baths: Optional[float] = None
    sqft: Optional[float] = None
    year_built: Optional[int] = None

    price: Optional[float] = None
    estimated_value: Optional[float] = None
    estimated_rent: Optional[float] = None
    # Sending a list replaces the property's tenants entirely (sending [] clears
    # them and reverts to a single manually-entered estimated_rent).
    tenants: Optional[list[TenantCreate]] = None

    property_tax_annual: Optional[float] = None
    insurance_annual: Optional[float] = None
    hoa_monthly: Optional[float] = None
    maintenance_pct_of_rent: Optional[float] = None
    vacancy_pct_of_rent: Optional[float] = None
    management_pct_of_rent: Optional[float] = None

    down_payment_pct: Optional[float] = None
    interest_rate: Optional[float] = None
    loan_term_years: Optional[int] = None
    closing_costs: Optional[float] = None
    purchase_date: Optional[date] = None

    annual_appreciation_pct: Optional[float] = None
    annual_rent_growth_pct: Optional[float] = None
    hold_period_years: Optional[int] = None
