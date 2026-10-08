import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  analyzeProperty,
  apiErrorMessage,
  getProperty,
  listTenants,
  refreshMarketData,
  updateProperty,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { money, num, pct } from '../format';

export default function PropertyDetail() {
  const { id } = useParams();
  const propertyId = Number(id);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || !!user?.can_edit_properties;
  const queryClient = useQueryClient();
  const [editingMarketData, setEditingMarketData] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editRent, setEditRent] = useState('');
  const [showCashFlowBreakdown, setShowCashFlowBreakdown] = useState(false);
  const [showMortgageBreakdown, setShowMortgageBreakdown] = useState(false);

  const propertyQuery = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => getProperty(propertyId),
  });

  const analysisQuery = useQuery({
    queryKey: ['analysis', propertyId],
    queryFn: () => analyzeProperty(propertyId),
    enabled: !!propertyQuery.data?.estimated_rent,
    retry: false,
  });

  const tenantsQuery = useQuery({
    queryKey: ['tenants', propertyId],
    queryFn: () => listTenants(propertyId),
  });

  const refresh = useMutation({
    mutationFn: () => refreshMarketData(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['analysis', propertyId] });
    },
  });

  const saveMarketData = useMutation({
    mutationFn: () =>
      updateProperty(propertyId, {
        estimated_value: editValue === '' ? null : Number(editValue),
        estimated_rent: editRent === '' ? null : Number(editRent),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['analysis', propertyId] });
      setEditingMarketData(false);
    },
  });

  const isAllCash = (propertyQuery.data?.down_payment_pct ?? 0) >= 0.999;

  const prop = propertyQuery.data;

  if (propertyQuery.isLoading) return <p>Loading…</p>;
  if (propertyQuery.error)
    return <div className="error-banner">{apiErrorMessage(propertyQuery.error)}</div>;
  if (!prop) return null;

  const analysis = analysisQuery.data;
  const bd = analysis?.cash_flow_breakdown;

  return (
    <div>
      <h2 className="page-title">
        {prop.address} {isAllCash && <span className="badge cash">cash purchase</span>}
      </h2>
      <p className="page-subtitle">
        {prop.city}, {prop.state} {prop.zip_code} · {money(prop.price)}
        {canEdit && (
          <>
            {' '}
            · <Link to={`/properties/${propertyId}/edit`}>Edit</Link>
          </>
        )}
      </p>

      {analysis && (
        <div className="card">
          <h2>Highlights</h2>
          <div className="stat-grid">
            <div
              className="stat"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowCashFlowBreakdown((v) => !v)}
              title="Click to see what makes up this number"
            >
              <div className="label">Monthly Cash Flow (click for breakdown)</div>
              <div className={`value ${analysis.cash_flow_monthly >= 0 ? 'positive' : 'negative'}`}>
                {money(analysis.cash_flow_monthly)}
              </div>
            </div>
            <div
              className="stat"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowMortgageBreakdown((v) => !v)}
              title="Click to see what makes up this number"
            >
              <div className="label">Mortgage Payment / mo (click for breakdown)</div>
              <div className="value">{money(analysis.monthly_mortgage_payment)}</div>
            </div>
            <div className="stat">
              <div className="label">Value</div>
              <div className="value">{money(prop.estimated_value ?? prop.price)}</div>
            </div>
            <div className="stat">
              <div className="label">Debt</div>
              <div className="value">{money(analysis.current_loan_balance)}</div>
            </div>
            <div className="stat">
              <div className="label">Equity</div>
              <div className="value">{money(analysis.equity)}</div>
            </div>
          </div>

          {showCashFlowBreakdown && bd && (
            <div style={{ marginTop: 20 }}>
              <table>
                <tbody>
                  <tr>
                    <td>Gross Rent (annual)</td>
                    <td>{money(bd.gross_rent_annual)}</td>
                  </tr>
                  <tr>
                    <td>− Vacancy Loss</td>
                    <td className="negative">{money(bd.vacancy_loss)}</td>
                  </tr>
                  <tr className="highlight">
                    <td>= Effective Gross Income</td>
                    <td>{money(bd.effective_gross_income)}</td>
                  </tr>
                  <tr>
                    <td>− Property Tax</td>
                    <td className="negative">{money(bd.property_tax_annual)}</td>
                  </tr>
                  <tr>
                    <td>− Insurance</td>
                    <td className="negative">{money(bd.insurance_annual)}</td>
                  </tr>
                  <tr>
                    <td>− HOA</td>
                    <td className="negative">{money(bd.hoa_annual)}</td>
                  </tr>
                  <tr>
                    <td>− Maintenance</td>
                    <td className="negative">{money(bd.maintenance_annual)}</td>
                  </tr>
                  <tr>
                    <td>− Management</td>
                    <td className="negative">{money(bd.management_annual)}</td>
                  </tr>
                  <tr className="highlight">
                    <td>= NOI (Net Operating Income)</td>
                    <td>{money(bd.noi)}</td>
                  </tr>
                  <tr>
                    <td>− Annual Debt Service (mortgage)</td>
                    <td className="negative">{money(bd.annual_debt_service)}</td>
                  </tr>
                  <tr className="highlight">
                    <td>= Cash Flow (annual)</td>
                    <td className={bd.cash_flow_annual >= 0 ? 'positive' : 'negative'}>
                      {money(bd.cash_flow_annual)}
                    </td>
                  </tr>
                  <tr className="highlight">
                    <td>= Cash Flow (monthly)</td>
                    <td className={bd.cash_flow_monthly >= 0 ? 'positive' : 'negative'}>
                      {money(bd.cash_flow_monthly)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {showMortgageBreakdown && (
            <div style={{ marginTop: 20 }}>
              {isAllCash ? (
                <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                  This property was purchased with cash — there's no mortgage.
                </p>
              ) : (
                <table>
                  <tbody>
                    <tr>
                      <td>Loan Amount</td>
                      <td>{money(analysis.loan_amount)}</td>
                    </tr>
                    <tr>
                      <td>Interest Rate</td>
                      <td>{pct(prop.interest_rate)}</td>
                    </tr>
                    <tr>
                      <td>Loan Term</td>
                      <td>{prop.loan_term_years} years</td>
                    </tr>
                    <tr className="highlight">
                      <td>= Monthly Payment (principal + interest)</td>
                      <td>{money(analysis.monthly_mortgage_payment)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>Market Data</h2>

        {editingMarketData ? (
          <>
            <div className="form-grid">
              <div className="field">
                <label>Est. Value ($) — e.g. Zillow Zestimate</label>
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Est. Monthly Rent ($) — e.g. Zillow Rent Zestimate</label>
                <input
                  type="number"
                  value={editRent}
                  onChange={(e) => setEditRent(e.target.value)}
                />
              </div>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Look these up at{' '}
              <a href="https://www.zillow.com" target="_blank" rel="noreferrer">
                zillow.com
              </a>{' '}
              and paste them in — there's no automated Zillow feed.
            </p>
            <button
              className="btn"
              onClick={() => saveMarketData.mutate()}
              disabled={saveMarketData.isPending}
            >
              {saveMarketData.isPending ? 'Saving…' : 'Save'}
            </button>{' '}
            <button className="btn secondary" onClick={() => setEditingMarketData(false)}>
              Cancel
            </button>
            {saveMarketData.isError && (
              <div className="error-banner" style={{ marginTop: 12 }}>
                {apiErrorMessage(saveMarketData.error)}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat">
                <div className="label">Estimated Value</div>
                <div className="value">
                  {prop.estimated_value ? money(prop.estimated_value) : '—'}
                </div>
              </div>
              <div className="stat">
                <div className="label">Estimated Rent</div>
                <div className="value">
                  {prop.estimated_rent ? money(prop.estimated_rent) : '—'}
                </div>
              </div>
            </div>

            {!!tenantsQuery.data?.length && (
              <div style={{ marginTop: 16 }}>
                <table>
                  <tbody>
                    {tenantsQuery.data.map((t) => (
                      <tr key={t.id}>
                        <td>{t.label || 'Unlabeled tenant'}</td>
                        <td>{money(t.monthly_rent)} / mo</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button
                className="btn secondary"
                onClick={() => {
                  setEditValue(prop.estimated_value?.toString() ?? '');
                  setEditRent(prop.estimated_rent?.toString() ?? '');
                  setEditingMarketData(true);
                }}
              >
                Edit manually
              </button>{' '}
              <button
                className="btn secondary"
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending}
              >
                {refresh.isPending ? 'Fetching…' : 'Refresh from RentCast'}
              </button>
              {refresh.isError && (
                <div className="error-banner" style={{ marginTop: 12 }}>
                  {apiErrorMessage(refresh.error)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!prop.estimated_rent && (
        <div className="card">
          <div className="empty-state">
            No rent estimate set — analysis unavailable. Refresh from RentCast or edit the
            property to add one manually.
          </div>
        </div>
      )}

      {analysisQuery.error && (
        <div className="error-banner">{apiErrorMessage(analysisQuery.error)}</div>
      )}

      {analysis && (
        <div className="card">
          <h2>Underwriting</h2>
          <div className="stat-grid">
            <div className="stat">
              <div className="label">Cap Rate</div>
              <div className="value">{pct(analysis.cap_rate)}</div>
            </div>
            <div className="stat">
              <div className="label">DSCR</div>
              <div className="value">{analysis.dscr !== null ? num(analysis.dscr) : '—'}</div>
            </div>
            <div className="stat">
              <div className="label">Cash-on-Cash ROI</div>
              <div className="value">{pct(analysis.cash_on_cash_roi)}</div>
            </div>
            <div className="stat">
              <div className="label">{prop.hold_period_years}yr IRR</div>
              <div className="value">{pct(analysis.irr)}</div>
            </div>
            <div className="stat">
              <div className="label">NOI</div>
              <div className="value">{money(analysis.noi)}</div>
            </div>
          </div>
        </div>
      )}

      {analysis && !isAllCash && (
        <div className="card">
          <h2>Loan Payoff Progress</h2>
          {!prop.purchase_date && (
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
              No purchase date set — assuming the loan just originated (0 payments made).{' '}
              <Link to={`/properties/${propertyId}/edit`}>Set a purchase date</Link> to track
              actual payoff progress.
            </p>
          )}
          <div className="stat-grid">
            <div className="stat">
              <div className="label">Loan Amount</div>
              <div className="value">{money(analysis.loan_amount)}</div>
            </div>
            <div className="stat">
              <div className="label">Current Balance</div>
              <div className="value">{money(analysis.current_loan_balance)}</div>
            </div>
            <div className="stat">
              <div className="label">Due Over Next 12mo</div>
              <div className="value">
                {analysis.next_year_mortgage_payments !== null
                  ? money(analysis.next_year_mortgage_payments)
                  : '—'}
              </div>
            </div>
            <div className="stat">
              <div className="label">Principal Paid</div>
              <div className="value positive">{money(analysis.principal_paid)}</div>
            </div>
            <div className="stat">
              <div className="label">Purchase Date</div>
              <div className="value">{prop.purchase_date ?? '—'}</div>
            </div>
            <div className="stat">
              <div className="label">Est. Payoff Date</div>
              <div className="value">{analysis.payoff_date ?? '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
