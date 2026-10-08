from datetime import date

import pytest

from app.api.analysis import _cash_flow_totals, _loan_payoff_status, analyze_property
from app.models.property import Property


def make_property(**overrides) -> Property:
    defaults = dict(
        workspace_id=1,
        address="1 Test St",
        city="Austin",
        state="TX",
        zip_code="78701",
        price=200_000,
        interest_rate=0.0,
        loan_term_years=10,
        purchase_date=None,
    )
    defaults.update(overrides)
    return Property(**defaults)


def test_loan_payoff_status_no_loan():
    prop = make_property()
    status = _loan_payoff_status(prop, loan_amount=0)
    assert status["current_loan_balance"] == 0
    assert status["principal_paid"] == 0
    assert status["pct_paid_off"] is None
    assert status["payoff_date"] is None
    assert status["months_remaining"] is None


def test_loan_payoff_status_no_purchase_date_assumes_no_payments_made():
    prop = make_property()
    status = _loan_payoff_status(prop, loan_amount=80_000)
    assert status["months_paid"] == 0
    assert status["current_loan_balance"] == pytest.approx(80_000)
    assert status["principal_paid"] == pytest.approx(0)
    assert status["pct_paid_off"] == pytest.approx(0)
    assert status["months_remaining"] == 120  # full 10yr term, nothing paid yet


def test_loan_payoff_status_with_purchase_date():
    # 0% rate, 10yr term -> $666.67/mo; 12 months elapsed -> $8,000 paid off
    prop = make_property(purchase_date=date(2020, 1, 1))
    status = _loan_payoff_status(prop, loan_amount=80_000)
    # months_paid is computed against date.today() internally, so just sanity
    # check the relationship between principal paid and balance instead of
    # pinning an exact month count that would drift with the test run date.
    assert status["current_loan_balance"] + status["principal_paid"] == pytest.approx(80_000)
    assert status["pct_paid_off"] == pytest.approx(
        status["principal_paid"] / 80_000
    )
    assert status["payoff_date"] == date(2030, 1, 1)
    assert status["months_remaining"] == 120 - status["months_paid"]


def test_loan_payoff_status_months_remaining_never_negative_past_term():
    # Purchased far enough in the past that the loan is already fully paid off
    prop = make_property(purchase_date=date(2000, 1, 1))
    status = _loan_payoff_status(prop, loan_amount=80_000)
    assert status["months_remaining"] == 0


def test_cash_flow_totals_no_purchase_date():
    prop = make_property()
    totals = _cash_flow_totals(prop, cash_flow_monthly=500)
    assert totals["cash_flow_since_purchase"] is None
    assert totals["cash_flow_ytd"] >= 0


def test_cash_flow_totals_since_purchase_matches_months_owned():
    prop = make_property(purchase_date=date(2020, 1, 1))
    totals = _cash_flow_totals(prop, cash_flow_monthly=500)
    from app.services import finance

    expected_months = finance.months_since(date(2020, 1, 1))
    assert totals["cash_flow_since_purchase"] == pytest.approx(500 * expected_months)


def test_cash_flow_totals_ytd_zero_for_negative_cash_flow_scaled_correctly():
    prop = make_property(purchase_date=date(2020, 1, 1))
    totals = _cash_flow_totals(prop, cash_flow_monthly=-200)
    from app.services import finance

    expected_ytd_months = finance.ytd_elapsed_months(date(2020, 1, 1))
    assert totals["cash_flow_ytd"] == pytest.approx(-200 * expected_ytd_months)


def test_next_year_mortgage_payments_full_year_when_loan_far_from_payoff():
    # 0% rate, 10yr term, just purchased -> full 12 months owed next year
    prop = make_property(
        price=100_000,
        down_payment_pct=0.2,
        interest_rate=0.0,
        loan_term_years=10,
        estimated_rent=1_000,
        purchase_date=date.today(),
    )
    result = analyze_property(prop)
    assert result["next_year_mortgage_payments"] == pytest.approx(
        result["monthly_mortgage_payment"] * 12
    )


def test_next_year_mortgage_payments_prorated_near_payoff():
    # Loan purchased 9 years 11 months ago on a 10yr term -> only 1 month left
    today = date.today()
    month = today.month - 11
    year = today.year - 9
    if month <= 0:
        month += 12
        year -= 1
    prop = make_property(
        price=100_000,
        down_payment_pct=0.2,
        interest_rate=0.0,
        loan_term_years=10,
        estimated_rent=1_000,
        purchase_date=date(year, month, 1),
    )
    result = analyze_property(prop)
    assert result["months_remaining"] is not None
    assert result["next_year_mortgage_payments"] == pytest.approx(
        result["monthly_mortgage_payment"] * min(12, result["months_remaining"])
    )


def test_next_year_mortgage_payments_none_for_cash_purchase():
    prop = make_property(
        price=100_000,
        down_payment_pct=1.0,
        estimated_rent=1_000,
    )
    result = analyze_property(prop)
    assert result["next_year_mortgage_payments"] is None
