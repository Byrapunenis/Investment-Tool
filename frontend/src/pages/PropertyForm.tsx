import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  apiErrorMessage,
  createProperty,
  getProperty,
  listTenants,
  updateProperty,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { PropertyCreate, TenantInput } from '../types/property';

let tenantRowKey = 0;
function emptyTenantRow(): TenantInput & { key: number } {
  return { key: tenantRowKey++, label: '', monthly_rent: 0 };
}

const initial: PropertyCreate = {
  address: '',
  city: '',
  state: '',
  zip_code: '',
  price: 0,
  estimated_value: undefined,
  estimated_rent: undefined,
  property_tax_annual: 0,
  insurance_annual: 0,
  hoa_monthly: 0,
  vacancy_pct_of_rent: 0,
  maintenance_pct_of_rent: 0,
  management_pct_of_rent: 0,
  down_payment_pct: 0.2,
  interest_rate: 0.065,
  loan_term_years: 30,
  closing_costs: 0,
  purchase_date: null,
  auto_fetch_market_data: false,
};

export default function PropertyForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const propertyId = Number(id);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || !!user?.can_edit_properties;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PropertyCreate>(initial);
  const [allCash, setAllCash] = useState(false);
  const [downPaymentUnit, setDownPaymentUnit] = useState<'percent' | 'dollar'>('percent');
  const [rentMode, setRentMode] = useState<'single' | 'multiple'>('single');
  const [tenantRows, setTenantRows] = useState<(TenantInput & { key: number })[]>([
    emptyTenantRow(),
  ]);

  const existing = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => getProperty(propertyId),
    enabled: isEdit,
  });

  const existingTenants = useQuery({
    queryKey: ['tenants', propertyId],
    queryFn: () => listTenants(propertyId),
    enabled: isEdit,
  });

  useEffect(() => {
    const tenants = existingTenants.data;
    if (!tenants) return;
    if (tenants.length > 0) {
      setRentMode('multiple');
      setTenantRows(
        tenants.map((t) => ({ key: tenantRowKey++, label: t.label ?? '', monthly_rent: t.monthly_rent })),
      );
    }
  }, [existingTenants.data]);

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setForm({
      address: p.address,
      city: p.city,
      state: p.state,
      zip_code: p.zip_code,
      price: p.price,
      estimated_value: p.estimated_value,
      estimated_rent: p.estimated_rent,
      property_tax_annual: p.property_tax_annual,
      insurance_annual: p.insurance_annual,
      hoa_monthly: p.hoa_monthly,
      vacancy_pct_of_rent: p.vacancy_pct_of_rent,
      maintenance_pct_of_rent: p.maintenance_pct_of_rent,
      management_pct_of_rent: p.management_pct_of_rent,
      down_payment_pct: p.down_payment_pct,
      interest_rate: p.interest_rate,
      loan_term_years: p.loan_term_years,
      closing_costs: p.closing_costs,
      purchase_date: p.purchase_date,
    });
    setAllCash(p.down_payment_pct >= 0.999);
  }, [existing.data]);

  const create = useMutation({
    mutationFn: createProperty,
    onSuccess: (prop) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      navigate(`/properties/${prop.id}`);
    },
  });

  const update = useMutation({
    mutationFn: (payload: Partial<PropertyCreate>) => updateProperty(propertyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['analysis', propertyId] });
      navigate(`/properties/${propertyId}`);
    },
  });

  function setField<K extends keyof PropertyCreate>(key: K, value: PropertyCreate[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toPercentDisplay(fraction: number | undefined): number {
    return Math.round((fraction ?? 0) * 10000) / 100;
  }

  function fromPercentInput(raw: string): number {
    return Number(raw) / 100;
  }

  function updateTenantRow(key: number, patch: Partial<TenantInput>) {
    setTenantRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addTenantRow() {
    setTenantRows((rows) => [...rows, emptyTenantRow()]);
  }

  function removeTenantRow(key: number) {
    setTenantRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  const tenantsTotalRent = tenantRows.reduce((sum, r) => sum + (Number(r.monthly_rent) || 0), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: PropertyCreate = { ...form, down_payment_pct: allCash ? 1 : form.down_payment_pct };
    if (rentMode === 'multiple') {
      payload.tenants = tenantRows
        .filter((r) => r.monthly_rent > 0 || r.label?.trim())
        .map((r) => ({ label: r.label?.trim() || null, monthly_rent: Number(r.monthly_rent) || 0 }));
    } else if (isEdit) {
      // Explicitly clear any tenants left over from a previous "multiple" save.
      payload.tenants = [];
    }
    if (isEdit) update.mutate(payload);
    else create.mutate(payload);
  }

  const saving = create.isPending || update.isPending;
  const saveError = create.error ?? update.error;

  if (isEdit && existing.isLoading) return <p>Loading…</p>;

  if (!canEdit) {
    return (
      <div className="empty-state">
        You have view-only access. Ask your workspace admin for permission to add or delete
        properties.
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">{isEdit ? 'Edit Property' : 'Add Property'}</h2>
      {!isEdit && (
        <p className="page-subtitle">
          Enter what you know. Leave rent/value blank to fetch from RentCast, or fill them in
          manually.
        </p>
      )}

      {saveError && <div className="error-banner">{apiErrorMessage(saveError)}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <h2>Location</h2>
        <div className="form-grid">
          <div className="field">
            <label>Address</label>
            <input
              required
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
            />
          </div>
          <div className="field">
            <label>City</label>
            <input required value={form.city} onChange={(e) => setField('city', e.target.value)} />
          </div>
          <div className="field">
            <label>State</label>
            <input
              required
              maxLength={2}
              value={form.state}
              onChange={(e) => setField('state', e.target.value.toUpperCase())}
            />
          </div>
          <div className="field">
            <label>Zip</label>
            <input
              required
              value={form.zip_code}
              onChange={(e) => setField('zip_code', e.target.value)}
            />
          </div>
        </div>

        <h2>Price & Rent</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: -8, marginBottom: 12 }}>
          Value/rent estimates aren't automated from Zillow (they don't offer a public API) —
          paste in a Zestimate/Rent Zestimate from zillow.com yourself, or use another source.
        </p>
        <div className="form-grid">
          <div className="field">
            <label>Purchase Price ($)</label>
            <input
              required
              type="number"
              value={form.price}
              onChange={(e) => setField('price', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Est. Value ($, optional — e.g. Zillow Zestimate)</label>
            <input
              type="number"
              value={form.estimated_value ?? ''}
              onChange={(e) =>
                setField('estimated_value', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </div>
          {rentMode === 'single' && (
            <div className="field">
              <label>Est. Monthly Rent ($, optional — e.g. Zillow Rent Zestimate)</label>
              <input
                type="number"
                value={form.estimated_rent ?? ''}
                onChange={(e) =>
                  setField('estimated_rent', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            </div>
          )}
          {!isEdit && rentMode === 'single' && (
            <div className="checkbox-row" style={{ alignSelf: 'end', paddingBottom: 8 }}>
              <input
                type="checkbox"
                id="autofetch"
                checked={form.auto_fetch_market_data}
                onChange={(e) => setField('auto_fetch_market_data', e.target.checked)}
              />
              <label htmlFor="autofetch">Or auto-fetch from RentCast instead</label>
            </div>
          )}
        </div>
        {isEdit && rentMode === 'single' && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: -8 }}>
            To pull fresh numbers from RentCast instead of typing them, use "Refresh from
            RentCast" on the property page.
          </p>
        )}

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Rent Roll</label>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
              <input
                type="radio"
                name="rentMode"
                checked={rentMode === 'single'}
                onChange={() => setRentMode('single')}
              />
              Single tenant (one rent figure)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
              <input
                type="radio"
                name="rentMode"
                checked={rentMode === 'multiple'}
                onChange={() => setRentMode('multiple')}
              />
              Multiple tenants (e.g. duplex, per-room rent)
            </label>
          </div>
        </div>

        {rentMode === 'multiple' && (
          <div style={{ marginBottom: 16 }}>
            {tenantRows.map((row, i) => (
              <div
                key={row.key}
                style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
              >
                <input
                  placeholder={`Tenant/unit label (e.g. Unit ${i + 1})`}
                  style={{ flex: 2 }}
                  value={row.label ?? ''}
                  onChange={(e) => updateTenantRow(row.key, { label: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Monthly rent ($)"
                  style={{ flex: 1 }}
                  value={row.monthly_rent || ''}
                  onChange={(e) => updateTenantRow(row.key, { monthly_rent: Number(e.target.value) })}
                />
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => removeTenantRow(row.key)}
                  disabled={tenantRows.length <= 1}
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn secondary" onClick={addTenantRow}>
              + Add tenant
            </button>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 8 }}>
              Total monthly rent: <strong>${tenantsTotalRent.toLocaleString()}</strong>
            </p>
          </div>
        )}

        <h2>Expenses (annual, unless noted)</h2>
        <div className="form-grid">
          <div className="field">
            <label>Property Tax ($/yr)</label>
            <input
              type="number"
              value={form.property_tax_annual}
              onChange={(e) => setField('property_tax_annual', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Insurance ($/yr)</label>
            <input
              type="number"
              value={form.insurance_annual}
              onChange={(e) => setField('insurance_annual', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>HOA ($/mo)</label>
            <input
              type="number"
              value={form.hoa_monthly}
              onChange={(e) => setField('hoa_monthly', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Closing Costs ($)</label>
            <input
              type="number"
              value={form.closing_costs}
              onChange={(e) => setField('closing_costs', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Vacancy Rate (% of rent)</label>
            <input
              type="number"
              value={toPercentDisplay(form.vacancy_pct_of_rent)}
              onChange={(e) => setField('vacancy_pct_of_rent', fromPercentInput(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Maintenance Rate (% of rent)</label>
            <input
              type="number"
              value={toPercentDisplay(form.maintenance_pct_of_rent)}
              onChange={(e) =>
                setField('maintenance_pct_of_rent', fromPercentInput(e.target.value))
              }
            />
          </div>
          <div className="field">
            <label>Management Fee (% of rent)</label>
            <input
              type="number"
              value={toPercentDisplay(form.management_pct_of_rent)}
              onChange={(e) =>
                setField('management_pct_of_rent', fromPercentInput(e.target.value))
              }
            />
          </div>
        </div>

        <h2>Financing</h2>
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Purchase Date (for loan payoff tracking)</label>
            <input
              type="date"
              value={form.purchase_date ?? ''}
              onChange={(e) =>
                setField('purchase_date', e.target.value === '' ? null : e.target.value)
              }
            />
          </div>
        </div>
        <div className="checkbox-row" style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            id="allcash"
            checked={allCash}
            onChange={(e) => setAllCash(e.target.checked)}
          />
          <label htmlFor="allcash">Bought without a loan (100% cash)</label>
        </div>
        {allCash ? (
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            No mortgage — down payment, rate, and term are hidden and cash invested will equal
            the full purchase price plus closing costs.
          </p>
        ) : (
          <div className="form-grid">
            <div className="field">
              <label>Down Payment</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  style={{ flex: 1, minWidth: 0 }}
                  value={
                    downPaymentUnit === 'percent'
                      ? Math.round((form.down_payment_pct ?? 0) * 100 * 100) / 100
                      : Math.round((form.down_payment_pct ?? 0) * form.price * 100) / 100
                  }
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const nextPct =
                      downPaymentUnit === 'percent'
                        ? raw / 100
                        : form.price > 0
                          ? raw / form.price
                          : 0;
                    setField('down_payment_pct', nextPct);
                  }}
                />
                <select
                  style={{ width: 58 }}
                  value={downPaymentUnit}
                  onChange={(e) => setDownPaymentUnit(e.target.value as 'percent' | 'dollar')}
                >
                  <option value="percent">%</option>
                  <option value="dollar">$</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Interest Rate (%)</label>
              <input
                type="number"
                value={toPercentDisplay(form.interest_rate)}
                onChange={(e) => setField('interest_rate', fromPercentInput(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Loan Term (years)</label>
              <input
                type="number"
                value={form.loan_term_years}
                onChange={(e) => setField('loan_term_years', Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Property'}
        </button>
      </form>
    </div>
  );
}
