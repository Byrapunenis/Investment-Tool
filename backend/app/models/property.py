from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Property(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    workspace_id: int = Field(foreign_key="workspace.id", index=True)

    address: str
    city: str
    state: str
    zip_code: str

    beds: Optional[float] = None
    baths: Optional[float] = None
    sqft: Optional[float] = None
    year_built: Optional[int] = None

    # Price / value — manual entry, optionally overwritten by RentCast AVM
    price: float
    estimated_value: Optional[float] = None
    estimated_rent: Optional[float] = None

    # Operating expenses (annual unless noted)
    property_tax_annual: float = 0
    insurance_annual: float = 0
    hoa_monthly: float = 0
    maintenance_pct_of_rent: float = 0.0
    vacancy_pct_of_rent: float = 0.0
    management_pct_of_rent: float = 0.0

    # Financing assumptions currently applied to this property
    down_payment_pct: float = 0.20
    interest_rate: float = 0.065
    loan_term_years: int = 30
    closing_costs: float = 0
    # When the loan actually originated — lets us compute how much of an
    # existing mortgage has been paid down. Unset means "assume no payments
    # made yet".
    purchase_date: Optional[date] = None

    # Growth assumptions for multi-year projections
    annual_appreciation_pct: float = 0.03
    annual_rent_growth_pct: float = 0.03
    hold_period_years: int = 10

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Tenant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(foreign_key="property.id", index=True)

    # e.g. "Unit A" or the tenant's name — purely a display label.
    label: Optional[str] = None
    monthly_rent: float

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MarketDataCache(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    address_key: str = Field(index=True, unique=True)
    value_estimate: Optional[float] = None
    rent_estimate: Optional[float] = None
    raw_response: Optional[str] = None
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
