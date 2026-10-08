import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiErrorMessage, getPortfolioSummary, listProperties } from '../api/client';
import { money } from '../format';

export default function CashFlow() {
  const summaryQuery = useQuery({ queryKey: ['portfolio-summary'], queryFn: getPortfolioSummary });
  const propertiesQuery = useQuery({ queryKey: ['properties'], queryFn: listProperties });

  const error = summaryQuery.error ?? propertiesQuery.error;
  const isLoading = summaryQuery.isLoading || propertiesQuery.isLoading;

  const propertyById = new Map((propertiesQuery.data ?? []).map((p) => [p.id, p]));
  const rows = summaryQuery.data?.properties ?? [];

  const totalSincePurchase = rows.reduce((sum, r) => sum + (r.cash_flow_since_purchase ?? 0), 0);
  const totalProjected = rows.reduce((sum, r) => sum + r.cash_flow_annual, 0);

  return (
    <div>
      <h2 className="page-title">Cash Flow</h2>
      <p className="page-subtitle">Total money made from each property</p>

      {error && <div className="error-banner">{apiErrorMessage(error)}</div>}
      {isLoading && <p>Loading…</p>}

      {!isLoading && rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            No properties with rent estimates yet. <Link to="/properties/new">Add one</Link>.
          </div>
        </div>
      ) : rows.length > 0 ? (
        <div className="card">
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat">
              <div className="label">Total Since Purchase</div>
              <div className={`value ${totalSincePurchase >= 0 ? 'positive' : 'negative'}`}>
                {money(totalSincePurchase)}
              </div>
            </div>
            <div className="stat">
              <div className="label">Total Projected (Full Year)</div>
              <div className={`value ${totalProjected >= 0 ? 'positive' : 'negative'}`}>
                {money(totalProjected)}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th>Purchase Date</th>
                <th>Cash Flow / mo</th>
                <th>Since Purchase</th>
                <th>Projected (Year)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const prop = propertyById.get(r.property_id);
                return (
                  <tr key={r.property_id}>
                    <td>
                      <Link to={`/properties/${r.property_id}`}>
                        {prop ? prop.address : `#${r.property_id}`}
                      </Link>
                    </td>
                    <td>{r.purchase_date ?? 'not set'}</td>
                    <td className={r.cash_flow_monthly >= 0 ? 'positive' : 'negative'}>
                      {money(r.cash_flow_monthly)}
                    </td>
                    <td
                      className={
                        r.cash_flow_since_purchase !== null && r.cash_flow_since_purchase < 0
                          ? 'negative'
                          : 'positive'
                      }
                    >
                      {r.cash_flow_since_purchase !== null
                        ? money(r.cash_flow_since_purchase)
                        : 'set purchase date'}
                    </td>
                    <td className={r.cash_flow_annual >= 0 ? 'positive' : 'negative'}>
                      {money(r.cash_flow_annual)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
