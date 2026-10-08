import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiErrorMessage, getPortfolioSummary } from '../api/client';
import { money, pct } from '../format';

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: getPortfolioSummary,
  });

  return (
    <div>
      <h2 className="page-title">Dashboard</h2>
      <p className="page-subtitle">Aggregate metrics across your properties</p>

      {error && <div className="error-banner">{apiErrorMessage(error)}</div>}
      {isLoading && <p>Loading…</p>}

      {data && (
        <>
          <div className="card">
            <h2>Portfolio</h2>
            <div className="stat-grid">
              <div className="stat">
                <div className="label">Properties</div>
                <div className="value">{data.property_count}</div>
              </div>
              <div className="stat">
                <div className="label">Total Value</div>
                <div className="value">{money(data.total_value)}</div>
              </div>
              <div className="stat">
                <div className="label">Cash Invested</div>
                <div className="value">{money(data.total_cash_invested)}</div>
              </div>
              <div className="stat">
                <div className="label">Monthly Cash Flow</div>
                <div
                  className={`value ${data.total_cash_flow_monthly >= 0 ? 'positive' : 'negative'}`}
                >
                  {money(data.total_cash_flow_monthly)}
                </div>
              </div>
              <div className="stat">
                <div className="label">Portfolio Cap Rate</div>
                <div className="value">{pct(data.portfolio_cap_rate)}</div>
              </div>
              <div className="stat">
                <div className="label">Portfolio Cash-on-Cash</div>
                <div className="value">{pct(data.portfolio_cash_on_cash_roi)}</div>
              </div>
              <div className="stat">
                <div className="label">Total Debt</div>
                <div className="value">{money(data.total_debt)}</div>
              </div>
              <div className="stat">
                <div className="label">Total Equity</div>
                <div className="value">{money(data.total_equity)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>This Year's Cash Flow</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: -8, marginBottom: 16 }}>
              Year-to-date grows automatically as each month passes; the projected total assumes
              today's numbers hold steady through December.
            </p>
            <div className="stat-grid">
              <div className="stat">
                <div className="label">Year-to-Date (Jan 1 → Now)</div>
                <div
                  className={`value ${data.total_cash_flow_ytd >= 0 ? 'positive' : 'negative'}`}
                >
                  {money(data.total_cash_flow_ytd)}
                </div>
              </div>
              <div className="stat">
                <div className="label">Full Year (Projected)</div>
                <div
                  className={`value ${data.total_cash_flow_annual >= 0 ? 'positive' : 'negative'}`}
                >
                  {money(data.total_cash_flow_annual)}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Properties</h2>
            {data.properties.length === 0 ? (
              <div className="empty-state">
                No properties with rent estimates yet.{' '}
                <Link to="/properties/new">Add one</Link>.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Cash Flow / mo</th>
                    <th>Cap Rate</th>
                    <th>Cash-on-Cash</th>
                    <th>DSCR</th>
                    <th>IRR</th>
                    <th>Debt</th>
                    <th>Equity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.properties.map((p) => (
                    <tr key={p.property_id}>
                      <td>
                        <Link to={`/properties/${p.property_id}`}>#{p.property_id}</Link>
                      </td>
                      <td className={p.cash_flow_monthly >= 0 ? 'positive' : 'negative'}>
                        {money(p.cash_flow_monthly)}
                      </td>
                      <td>{pct(p.cap_rate)}</td>
                      <td>{pct(p.cash_on_cash_roi)}</td>
                      <td>{p.dscr?.toFixed(2) ?? '—'}</td>
                      <td>{pct(p.irr)}</td>
                      <td>{money(p.current_loan_balance)}</td>
                      <td>{money(p.equity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
