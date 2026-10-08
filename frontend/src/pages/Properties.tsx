import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiErrorMessage, deleteProperty, getPortfolioSummary, listProperties } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { money, monthsAsYearsMonths } from '../format';
import type { DealAnalysis, Property } from '../types/property';

function MortgageLine({ p, analysis }: { p: Property; analysis: DealAnalysis | undefined }) {
  const isAllCash = p.down_payment_pct >= 0.999;
  if (isAllCash) return null;
  if (!analysis) {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
        mortgage: set rent to calculate
      </div>
    );
  }
  return (
    <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
      {money(analysis.monthly_mortgage_payment)}/mo · payoff in{' '}
      {monthsAsYearsMonths(analysis.months_remaining)}
      {analysis.payoff_date ? ` (${analysis.payoff_date})` : ''}
      {analysis.next_year_mortgage_payments !== null &&
        ` · ${money(analysis.next_year_mortgage_payments)} due over next 12mo`}
    </div>
  );
}

function PropertyRow({
  p,
  analysis,
  onDelete,
  canEdit,
}: {
  p: Property;
  analysis: DealAnalysis | undefined;
  onDelete: (id: number) => void;
  canEdit: boolean;
}) {
  return (
    <div className="property-row">
      <Link to={`/properties/${p.id}`} style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {p.down_payment_pct >= 0.999 && <span className="badge cash">cash</span>}
          <strong>{p.address}</strong>
          <span style={{ color: 'var(--text-dim)' }}>
            {p.city}, {p.state} {p.zip_code}
          </span>
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
          {money(p.price)} · rent {p.estimated_rent ? money(p.estimated_rent) : 'not set'}
        </div>
        <MortgageLine p={p} analysis={analysis} />
      </Link>
      {canEdit && (
        <>
          <Link to={`/properties/${p.id}/edit`} className="btn secondary" style={{ marginRight: 8 }}>
            Edit
          </Link>
          <button className="btn secondary" onClick={() => onDelete(p.id)}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}

export default function Properties() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || !!user?.can_edit_properties;
  const queryClient = useQueryClient();
  const propertiesQuery = useQuery({ queryKey: ['properties'], queryFn: listProperties });
  const summaryQuery = useQuery({ queryKey: ['portfolio-summary'], queryFn: getPortfolioSummary });

  const del = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
    },
  });

  const data = propertiesQuery.data;
  const error = propertiesQuery.error ?? summaryQuery.error;
  const isLoading = propertiesQuery.isLoading;

  const analysisById = new Map((summaryQuery.data?.properties ?? []).map((r) => [r.property_id, r]));

  return (
    <div>
      <h2 className="page-title">Properties</h2>
      <p className="page-subtitle">Your properties</p>

      {error && <div className="error-banner">{apiErrorMessage(error)}</div>}
      {isLoading && <p>Loading…</p>}

      <div className="card">
        <h2>Properties ({data?.length ?? 0})</h2>
        {!data || data.length === 0 ? (
          <div className="empty-state">
            {canEdit ? (
              <>
                No properties yet. <Link to="/properties/new">Add one</Link>.
              </>
            ) : (
              'No properties yet.'
            )}
          </div>
        ) : (
          <div className="property-list">
            {data.map((p) => (
              <PropertyRow
                key={p.id}
                p={p}
                analysis={analysisById.get(p.id)}
                onDelete={(id) => del.mutate(id)}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
