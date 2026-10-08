from dataclasses import dataclass
from datetime import date
from typing import Optional

import numpy_financial as npf

SELLING_COST_PCT = 0.06  # typical realtor commission + closing costs at sale


def months_since(start: date, end: Optional[date] = None) -> int:
    end = end or date.today()
    return max((end.year - start.year) * 12 + (end.month - start.month), 0)


def ytd_elapsed_months(purchase_date: Optional[date], today: Optional[date] = None) -> int:
    """Whole months elapsed since Jan 1 of the current year, capped by purchase_date
    if the property was bought partway through this year. Whole-months-only, same
    convention as months_since (no partial-month credit)."""
    today = today or date.today()
    jan1 = date(today.year, 1, 1)
    year_start = purchase_date if purchase_date and purchase_date > jan1 else jan1
    return months_since(year_start, today)


def monthly_mortgage_payment(loan_amount: float, annual_rate: float, term_years: int) -> float:
    n = term_years * 12
    if n <= 0:
        return 0.0
    r = annual_rate / 12
    if r == 0:
        return loan_amount / n
    return loan_amount * r * (1 + r) ** n / ((1 + r) ** n - 1)


def remaining_balance(
    loan_amount: float, annual_rate: float, term_years: int, payments_made: int
) -> float:
    n = term_years * 12
    payments_made = min(payments_made, n)
    if payments_made <= 0:
        return loan_amount
    r = annual_rate / 12
    m = monthly_mortgage_payment(loan_amount, annual_rate, term_years)
    if r == 0:
        return max(loan_amount - m * payments_made, 0.0)
    balance = loan_amount * (1 + r) ** payments_made - m * ((1 + r) ** payments_made - 1) / r
    return max(balance, 0.0)


@dataclass
class OperatingFigures:
    gross_rent_annual: float
    vacancy_loss: float
    effective_gross_income: float
    property_tax_annual: float
    insurance_annual: float
    hoa_annual: float
    maintenance_annual: float
    management_annual: float
    operating_expenses: float
    noi: float


def compute_operating_figures(
    monthly_rent: float,
    property_tax_annual: float,
    insurance_annual: float,
    hoa_monthly: float,
    maintenance_pct_of_rent: float,
    vacancy_pct_of_rent: float,
    management_pct_of_rent: float,
) -> OperatingFigures:
    gross_rent_annual = monthly_rent * 12
    vacancy_loss = gross_rent_annual * vacancy_pct_of_rent
    effective_gross_income = gross_rent_annual - vacancy_loss

    hoa_annual = hoa_monthly * 12
    maintenance_annual = maintenance_pct_of_rent * gross_rent_annual
    management_annual = management_pct_of_rent * gross_rent_annual

    operating_expenses = (
        property_tax_annual
        + insurance_annual
        + hoa_annual
        + maintenance_annual
        + management_annual
    )
    noi = effective_gross_income - operating_expenses

    return OperatingFigures(
        gross_rent_annual=gross_rent_annual,
        vacancy_loss=vacancy_loss,
        effective_gross_income=effective_gross_income,
        property_tax_annual=property_tax_annual,
        insurance_annual=insurance_annual,
        hoa_annual=hoa_annual,
        maintenance_annual=maintenance_annual,
        management_annual=management_annual,
        operating_expenses=operating_expenses,
        noi=noi,
    )


def cap_rate(noi: float, price: float) -> Optional[float]:
    if price <= 0:
        return None
    return noi / price


def cash_on_cash_roi(annual_cash_flow: float, cash_invested: float) -> Optional[float]:
    if cash_invested <= 0:
        return None
    return annual_cash_flow / cash_invested


def dscr(noi: float, annual_debt_service: float) -> Optional[float]:
    if annual_debt_service <= 0:
        return None
    return noi / annual_debt_service


@dataclass
class DealMetrics:
    loan_amount: float
    monthly_mortgage_payment: float
    annual_debt_service: float
    cash_invested: float
    noi: float
    cash_flow_annual: float
    cash_flow_monthly: float
    cap_rate: Optional[float]
    cash_on_cash_roi: Optional[float]
    dscr: Optional[float]
    operating: OperatingFigures


def analyze_deal(
    price: float,
    monthly_rent: float,
    down_payment_pct: float,
    interest_rate: float,
    loan_term_years: int,
    closing_costs: float,
    property_tax_annual: float,
    insurance_annual: float,
    hoa_monthly: float,
    maintenance_pct_of_rent: float,
    vacancy_pct_of_rent: float,
    management_pct_of_rent: float,
) -> DealMetrics:
    loan_amount = price * (1 - down_payment_pct)
    payment = monthly_mortgage_payment(loan_amount, interest_rate, loan_term_years)
    annual_debt_service = payment * 12
    cash_invested = price * down_payment_pct + closing_costs

    operating = compute_operating_figures(
        monthly_rent=monthly_rent,
        property_tax_annual=property_tax_annual,
        insurance_annual=insurance_annual,
        hoa_monthly=hoa_monthly,
        maintenance_pct_of_rent=maintenance_pct_of_rent,
        vacancy_pct_of_rent=vacancy_pct_of_rent,
        management_pct_of_rent=management_pct_of_rent,
    )

    cash_flow_annual = operating.noi - annual_debt_service

    return DealMetrics(
        loan_amount=loan_amount,
        monthly_mortgage_payment=payment,
        annual_debt_service=annual_debt_service,
        cash_invested=cash_invested,
        noi=operating.noi,
        cash_flow_annual=cash_flow_annual,
        cash_flow_monthly=cash_flow_annual / 12,
        cap_rate=cap_rate(operating.noi, price),
        cash_on_cash_roi=cash_on_cash_roi(cash_flow_annual, cash_invested),
        dscr=dscr(operating.noi, annual_debt_service),
        operating=operating,
    )


def project_irr(
    price: float,
    monthly_rent: float,
    down_payment_pct: float,
    interest_rate: float,
    loan_term_years: int,
    closing_costs: float,
    property_tax_annual: float,
    insurance_annual: float,
    hoa_monthly: float,
    maintenance_pct_of_rent: float,
    vacancy_pct_of_rent: float,
    management_pct_of_rent: float,
    annual_appreciation_pct: float,
    annual_rent_growth_pct: float,
    hold_period_years: int,
) -> dict:
    loan_amount = price * (1 - down_payment_pct)
    cash_invested = price * down_payment_pct + closing_costs
    annual_debt_service = monthly_mortgage_payment(loan_amount, interest_rate, loan_term_years) * 12

    cashflows = [-cash_invested]
    rent = monthly_rent
    for year in range(1, hold_period_years + 1):
        operating = compute_operating_figures(
            monthly_rent=rent,
            property_tax_annual=property_tax_annual,
            insurance_annual=insurance_annual,
            hoa_monthly=hoa_monthly,
            maintenance_pct_of_rent=maintenance_pct_of_rent,
            vacancy_pct_of_rent=vacancy_pct_of_rent,
            management_pct_of_rent=management_pct_of_rent,
        )
        year_cash_flow = operating.noi - annual_debt_service

        if year == hold_period_years:
            sale_price = price * (1 + annual_appreciation_pct) ** hold_period_years
            selling_costs = sale_price * SELLING_COST_PCT
            balance = remaining_balance(
                loan_amount, interest_rate, loan_term_years, hold_period_years * 12
            )
            net_sale_proceeds = sale_price - selling_costs - balance
            year_cash_flow += net_sale_proceeds

        cashflows.append(year_cash_flow)
        rent = rent * (1 + annual_rent_growth_pct)

    irr = npf.irr(cashflows)
    return {
        "cashflows": cashflows,
        "irr": None if irr is None or irr != irr else float(irr),  # filter NaN
    }
