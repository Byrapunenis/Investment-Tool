export interface Property {
  id: number;
  address: string;
  city: string;
  state: string;
  zip_code: string;

  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;

  price: number;
  estimated_value: number | null;
  estimated_rent: number | null;

  property_tax_annual: number;
  insurance_annual: number;
  hoa_monthly: number;
  maintenance_pct_of_rent: number;
  vacancy_pct_of_rent: number;
  management_pct_of_rent: number;

  down_payment_pct: number;
  interest_rate: number;
  loan_term_years: number;
  closing_costs: number;
  purchase_date: string | null;

  annual_appreciation_pct: number;
  annual_rent_growth_pct: number;
  hold_period_years: number;

  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: number;
  property_id: number;
  label: string | null;
  monthly_rent: number;
  created_at: string;
}

export interface TenantInput {
  label?: string | null;
  monthly_rent: number;
}

export interface PropertyCreate {
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  estimated_value?: number | null;
  estimated_rent?: number | null;
  tenants?: TenantInput[] | null;
  property_tax_annual?: number;
  insurance_annual?: number;
  hoa_monthly?: number;
  vacancy_pct_of_rent?: number;
  maintenance_pct_of_rent?: number;
  management_pct_of_rent?: number;
  down_payment_pct?: number;
  interest_rate?: number;
  loan_term_years?: number;
  closing_costs?: number;
  purchase_date?: string | null;
  auto_fetch_market_data?: boolean;
}

export interface CashFlowBreakdown {
  gross_rent_annual: number;
  vacancy_loss: number;
  effective_gross_income: number;
  property_tax_annual: number;
  insurance_annual: number;
  hoa_annual: number;
  maintenance_annual: number;
  management_annual: number;
  operating_expenses_total: number;
  noi: number;
  annual_debt_service: number;
  cash_flow_annual: number;
  cash_flow_monthly: number;
}

export interface DealAnalysis {
  property_id: number;
  loan_amount: number;
  monthly_mortgage_payment: number;
  annual_debt_service: number;
  cash_invested: number;
  noi: number;
  cash_flow_annual: number;
  cash_flow_monthly: number;
  cap_rate: number | null;
  cash_on_cash_roi: number | null;
  dscr: number | null;
  gross_rent_annual: number;
  operating_expenses: number;
  irr: number | null;
  irr_cashflows: number[];
  current_loan_balance: number;
  principal_paid: number;
  pct_paid_off: number | null;
  months_paid: number;
  payoff_date: string | null;
  purchase_date: string | null;
  months_remaining: number | null;
  next_year_mortgage_payments: number | null;
  equity: number;
  cash_flow_ytd: number;
  cash_flow_since_purchase: number | null;
  cash_flow_breakdown: CashFlowBreakdown;
}

export interface PortfolioSummary {
  property_count: number;
  analyzed_count: number;
  total_value: number;
  total_cash_invested: number;
  total_cash_flow_monthly: number;
  total_cash_flow_annual: number;
  total_cash_flow_ytd: number;
  total_debt: number;
  total_equity: number;
  portfolio_cap_rate: number | null;
  portfolio_cash_on_cash_roi: number | null;
  properties: DealAnalysis[];
}
