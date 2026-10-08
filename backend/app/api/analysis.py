from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.property import Property
from app.models.user import User
from app.services import finance

router = APIRouter(tags=["analysis"])


def require_rent(prop: Property) -> float:
    if not prop.estimated_rent:
        raise HTTPException(
            status_code=400,
            detail="Property has no estimated_rent. Set it manually or refresh market data.",
        )
    return prop.estimated_rent


def _loan_payoff_status(prop: Property, loan_amount: float) -> dict:
    if loan_amount <= 0:
        return {
            "purchase_date": prop.purchase_date,
            "months_paid": 0,
            "current_loan_balance": 0.0,
            "principal_paid": 0.0,
            "pct_paid_off": None,
            "payoff_date": None,
            "months_remaining": None,
        }

    months_paid = finance.months_since(prop.purchase_date) if prop.purchase_date else 0
    current_balance = finance.remaining_balance(
        loan_amount, prop.interest_rate, prop.loan_term_years, months_paid
    )
    principal_paid = loan_amount - current_balance
    months_remaining = max(prop.loan_term_years * 12 - months_paid, 0)

    payoff_date = None
    if prop.purchase_date:
        try:
            payoff_date = prop.purchase_date.replace(
                year=prop.purchase_date.year + prop.loan_term_years
            )
        except ValueError:
            payoff_date = prop.purchase_date.replace(
                year=prop.purchase_date.year + prop.loan_term_years, day=28
            )

    return {
        "purchase_date": prop.purchase_date,
        "months_paid": months_paid,
        "current_loan_balance": current_balance,
        "principal_paid": principal_paid,
        "pct_paid_off": principal_paid / loan_amount,
        "payoff_date": payoff_date,
        "months_remaining": months_remaining,
    }


def _cash_flow_totals(prop: Property, cash_flow_monthly: float) -> dict:
    ytd_months = finance.ytd_elapsed_months(prop.purchase_date)
    cash_flow_ytd = cash_flow_monthly * ytd_months

    cash_flow_since_purchase = None
    if prop.purchase_date:
        months_owned = finance.months_since(prop.purchase_date)
        cash_flow_since_purchase = cash_flow_monthly * months_owned

    return {
        "cash_flow_ytd": cash_flow_ytd,
        "cash_flow_since_purchase": cash_flow_since_purchase,
    }


def analyze_property(prop: Property) -> dict:
    monthly_rent = require_rent(prop)

    metrics = finance.analyze_deal(
        price=prop.price,
        monthly_rent=monthly_rent,
        down_payment_pct=prop.down_payment_pct,
        interest_rate=prop.interest_rate,
        loan_term_years=prop.loan_term_years,
        closing_costs=prop.closing_costs,
        property_tax_annual=prop.property_tax_annual,
        insurance_annual=prop.insurance_annual,
        hoa_monthly=prop.hoa_monthly,
        maintenance_pct_of_rent=prop.maintenance_pct_of_rent,
        vacancy_pct_of_rent=prop.vacancy_pct_of_rent,
        management_pct_of_rent=prop.management_pct_of_rent,
    )

    irr_result = finance.project_irr(
        price=prop.price,
        monthly_rent=monthly_rent,
        down_payment_pct=prop.down_payment_pct,
        interest_rate=prop.interest_rate,
        loan_term_years=prop.loan_term_years,
        closing_costs=prop.closing_costs,
        property_tax_annual=prop.property_tax_annual,
        insurance_annual=prop.insurance_annual,
        hoa_monthly=prop.hoa_monthly,
        maintenance_pct_of_rent=prop.maintenance_pct_of_rent,
        vacancy_pct_of_rent=prop.vacancy_pct_of_rent,
        management_pct_of_rent=prop.management_pct_of_rent,
        annual_appreciation_pct=prop.annual_appreciation_pct,
        annual_rent_growth_pct=prop.annual_rent_growth_pct,
        hold_period_years=prop.hold_period_years,
    )

    payoff = _loan_payoff_status(prop, metrics.loan_amount)
    current_value = prop.estimated_value or prop.price
    equity = current_value - payoff["current_loan_balance"]
    cash_flow_totals = _cash_flow_totals(prop, metrics.cash_flow_monthly)

    next_year_mortgage_payments = None
    if metrics.loan_amount > 0 and payoff["months_remaining"] is not None:
        months_to_pay = min(12, payoff["months_remaining"])
        next_year_mortgage_payments = metrics.monthly_mortgage_payment * months_to_pay

    op = metrics.operating
    cash_flow_breakdown = {
        "gross_rent_annual": op.gross_rent_annual,
        "vacancy_loss": op.vacancy_loss,
        "effective_gross_income": op.effective_gross_income,
        "property_tax_annual": op.property_tax_annual,
        "insurance_annual": op.insurance_annual,
        "hoa_annual": op.hoa_annual,
        "maintenance_annual": op.maintenance_annual,
        "management_annual": op.management_annual,
        "operating_expenses_total": op.operating_expenses,
        "noi": op.noi,
        "annual_debt_service": metrics.annual_debt_service,
        "cash_flow_annual": metrics.cash_flow_annual,
        "cash_flow_monthly": metrics.cash_flow_monthly,
    }

    return {
        "property_id": prop.id,
        "loan_amount": metrics.loan_amount,
        "monthly_mortgage_payment": metrics.monthly_mortgage_payment,
        "annual_debt_service": metrics.annual_debt_service,
        "cash_invested": metrics.cash_invested,
        "noi": metrics.noi,
        "cash_flow_annual": metrics.cash_flow_annual,
        "cash_flow_monthly": metrics.cash_flow_monthly,
        "cap_rate": metrics.cap_rate,
        "cash_on_cash_roi": metrics.cash_on_cash_roi,
        "dscr": metrics.dscr,
        "gross_rent_annual": metrics.operating.gross_rent_annual,
        "operating_expenses": metrics.operating.operating_expenses,
        "irr": irr_result["irr"],
        "irr_cashflows": irr_result["cashflows"],
        "current_loan_balance": payoff["current_loan_balance"],
        "principal_paid": payoff["principal_paid"],
        "pct_paid_off": payoff["pct_paid_off"],
        "months_paid": payoff["months_paid"],
        "payoff_date": payoff["payoff_date"],
        "purchase_date": payoff["purchase_date"],
        "months_remaining": payoff["months_remaining"],
        "next_year_mortgage_payments": next_year_mortgage_payments,
        "equity": equity,
        "cash_flow_ytd": cash_flow_totals["cash_flow_ytd"],
        "cash_flow_since_purchase": cash_flow_totals["cash_flow_since_purchase"],
        "cash_flow_breakdown": cash_flow_breakdown,
    }


@router.get("/properties/{property_id}/analyze")
def analyze(
    property_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    prop = session.get(Property, property_id)
    if not prop or prop.workspace_id != current_user.workspace_id:
        raise HTTPException(status_code=404, detail="Property not found")
    return analyze_property(prop)


@router.get("/portfolio/summary")
def portfolio_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    properties = session.exec(
        select(Property).where(Property.workspace_id == current_user.workspace_id)
    ).all()

    rows = []
    for prop in properties:
        if not prop.estimated_rent:
            continue
        rows.append(analyze_property(prop))

    total_value = sum((p.estimated_value or p.price) for p in properties)
    total_cash_invested = sum(r["cash_invested"] for r in rows)
    total_cash_flow_monthly = sum(r["cash_flow_monthly"] for r in rows)
    total_noi = sum(r["noi"] for r in rows)
    total_debt = sum(r["current_loan_balance"] for r in rows)
    total_equity = sum(r["equity"] for r in rows)
    total_cash_flow_ytd = sum(r["cash_flow_ytd"] for r in rows)

    return {
        "property_count": len(properties),
        "analyzed_count": len(rows),
        "total_value": total_value,
        "total_cash_invested": total_cash_invested,
        "total_cash_flow_monthly": total_cash_flow_monthly,
        "total_cash_flow_annual": total_cash_flow_monthly * 12,
        "total_cash_flow_ytd": total_cash_flow_ytd,
        "total_debt": total_debt,
        "total_equity": total_equity,
        "portfolio_cap_rate": (total_noi / total_value) if total_value else None,
        "portfolio_cash_on_cash_roi": (
            (total_cash_flow_monthly * 12) / total_cash_invested if total_cash_invested else None
        ),
        "properties": rows,
    }
