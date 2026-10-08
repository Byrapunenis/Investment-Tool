# Real Estate Optimizer (v1)

Personal real estate investment tool: track your portfolio, underwrite deals
(cap rate, cash flow, cash-on-cash ROI, DSCR, IRR), optimize financing terms
for a property, and optimize which candidate deals to buy under a capital
budget.

## Setup

### Backend (Python / FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash; use .venv\Scripts\Activate.ps1 in PowerShell
pip install -r requirements.txt
cp .env.example .env            # then add your RentCast API key (optional)
uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs. Runs fine with `RENTCAST_API_KEY`
unset — you just won't be able to auto-fetch value/rent estimates and will
need to enter rent manually per property.

Run tests: `pytest` (from `backend/`, with the venv active).

### Frontend (React / Vite)

```bash
cd frontend
npm install
npm run dev
```

Opens at http://localhost:5173 and talks to the backend on :8000 (CORS is
pre-configured for this pairing).

## Getting a RentCast API key (optional but recommended)

1. Sign up at rentcast.io — free tier includes ~50 API calls/month.
2. Copy your API key into `backend/.env` as `RENTCAST_API_KEY=...`.
3. Restart the backend. New properties can now use "Fetch value/rent from
   RentCast" instead of manual entry. Responses are cached for 7 days so
   repeat lookups don't burn your free-tier quota.

## What's in v1

- **Properties**: add/track owned properties and candidate deals.
- **Underwriting** (`/properties/{id}/analyze`): cap rate, monthly cash flow,
  cash-on-cash ROI, DSCR, multi-year IRR projection.
- **Financing optimizer** (`/properties/{id}/finance-optimize`): grid search
  over down payment / rate / term combinations to maximize cash-on-cash ROI
  or IRR, subject to a minimum cash flow constraint.
- **Portfolio optimizer** (`/portfolio/optimize`): given a set of candidate
  properties and a capital budget, solves a 0/1 knapsack (via PuLP) to pick
  the subset that maximizes total return.
- **Dashboard**: aggregate portfolio metrics across owned properties.

## Not in v1 (future phases)

- Renovation/development feasibility analysis
- Deeper rent-pricing models beyond RentCast's estimate
- Multi-market comparison tooling
- Multi-user support / auth (this is a single-user local tool)
