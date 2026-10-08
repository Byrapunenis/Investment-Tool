from datetime import date

import pytest

from app.services import finance


def test_months_since_basic():
    assert finance.months_since(date(2024, 1, 15), date(2024, 7, 15)) == 6


def test_months_since_full_years():
    assert finance.months_since(date(2020, 3, 1), date(2024, 3, 1)) == 48


def test_months_since_never_negative():
    assert finance.months_since(date(2025, 1, 1), date(2024, 1, 1)) == 0


def test_ytd_elapsed_months_owned_before_this_year():
    # Bought in 2022, today is August 2026 -> full 7 months elapsed since Jan 1
    assert finance.ytd_elapsed_months(date(2022, 5, 1), today=date(2026, 8, 5)) == 7


def test_ytd_elapsed_months_no_purchase_date_assumes_owned_all_year():
    assert finance.ytd_elapsed_months(None, today=date(2026, 8, 5)) == 7


def test_ytd_elapsed_months_purchased_partway_through_this_year():
    # Bought April 1 this year -> 4 whole months elapsed (Apr->May->Jun->Jul->Aug) by Aug 5
    assert finance.ytd_elapsed_months(date(2026, 4, 1), today=date(2026, 8, 5)) == 4


def test_ytd_elapsed_months_purchased_this_month():
    assert finance.ytd_elapsed_months(date(2026, 8, 1), today=date(2026, 8, 5)) == 0


def test_monthly_mortgage_payment_known_value():
    # $200k loan, 6% APR, 30yr term -> well-known ~$1199.10/mo
    payment = finance.monthly_mortgage_payment(200_000, 0.06, 30)
    assert payment == pytest.approx(1199.10, abs=0.05)


def test_monthly_mortgage_payment_zero_rate():
    payment = finance.monthly_mortgage_payment(120_000, 0.0, 10)
    assert payment == pytest.approx(1000.0)


def test_remaining_balance_zero_rate():
    # $80k loan, 0% rate, 10yr term -> $666.67/mo; after 12 payments, $8000 paid off
    balance = finance.remaining_balance(80_000, 0.0, 10, 12)
    assert balance == pytest.approx(72_000, abs=1)


def test_analyze_deal_all_cash_no_expenses():
    metrics = finance.analyze_deal(
        price=100_000,
        monthly_rent=1_000,
        down_payment_pct=1.0,
        interest_rate=0.06,
        loan_term_years=30,
        closing_costs=0,
        property_tax_annual=0,
        insurance_annual=0,
        hoa_monthly=0,
        maintenance_pct_of_rent=0,
        vacancy_pct_of_rent=0,
        management_pct_of_rent=0,
    )
    assert metrics.loan_amount == 0
    assert metrics.noi == pytest.approx(12_000)
    assert metrics.cap_rate == pytest.approx(0.12)
    assert metrics.cash_invested == pytest.approx(100_000)
    assert metrics.cash_on_cash_roi == pytest.approx(0.12)
    assert metrics.dscr is None  # no debt service -> undefined DSCR


def test_analyze_deal_with_financing():
    metrics = finance.analyze_deal(
        price=100_000,
        monthly_rent=1_000,
        down_payment_pct=0.2,
        interest_rate=0.0,
        loan_term_years=10,
        closing_costs=0,
        property_tax_annual=0,
        insurance_annual=0,
        hoa_monthly=0,
        maintenance_pct_of_rent=0,
        vacancy_pct_of_rent=0,
        management_pct_of_rent=0,
    )
    # loan = 80,000 at 0% over 10yr -> 8,000/yr debt service
    assert metrics.annual_debt_service == pytest.approx(8_000, abs=1)
    assert metrics.cash_invested == pytest.approx(20_000)
    assert metrics.noi == pytest.approx(12_000)
    assert metrics.cash_flow_annual == pytest.approx(4_000, abs=1)
    assert metrics.cash_on_cash_roi == pytest.approx(0.2, abs=0.001)
    assert metrics.dscr == pytest.approx(1.5, abs=0.01)


def test_analyze_deal_expenses_reduce_noi():
    metrics = finance.analyze_deal(
        price=100_000,
        monthly_rent=1_000,
        down_payment_pct=1.0,
        interest_rate=0.06,
        loan_term_years=30,
        closing_costs=0,
        property_tax_annual=1_200,
        insurance_annual=600,
        hoa_monthly=50,
        maintenance_pct_of_rent=0.1,
        vacancy_pct_of_rent=0.05,
        management_pct_of_rent=0.0,
    )
    # gross rent 12,000; vacancy loss 600 -> EGI 11,400
    # opex = 1200 + 600 + 600(hoa) + 1200(maint 10%) = 3600
    # noi = 11400 - 3600 = 7800
    assert metrics.operating.gross_rent_annual == pytest.approx(12_000)
    assert metrics.operating.vacancy_loss == pytest.approx(600)
    assert metrics.noi == pytest.approx(7_800)
