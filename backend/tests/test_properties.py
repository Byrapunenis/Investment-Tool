from sqlmodel import select

from app.models.property import Tenant

BASE = {
    "address": "1 Test St",
    "city": "Austin",
    "state": "TX",
    "zip_code": "78701",
    "price": 200_000,
}


def test_create_property_without_tenants_uses_given_rent(client, auth_headers):
    res = client.post("/properties", json={**BASE, "estimated_rent": 1800}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["estimated_rent"] == 1800

    tenants = client.get(f"/properties/{data['id']}/tenants", headers=auth_headers).json()
    assert tenants == []


def test_create_property_with_tenants_sums_into_estimated_rent(client, auth_headers):
    payload = {
        **BASE,
        "tenants": [
            {"label": "Unit A", "monthly_rent": 1500},
            {"label": "Unit B", "monthly_rent": 1200},
        ],
    }
    res = client.post("/properties", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["estimated_rent"] == 2700

    tenants = client.get(f"/properties/{data['id']}/tenants", headers=auth_headers).json()
    assert {t["label"] for t in tenants} == {"Unit A", "Unit B"}
    assert sum(t["monthly_rent"] for t in tenants) == 2700


def test_create_property_tenants_take_precedence_over_manual_estimated_rent(client, auth_headers):
    payload = {
        **BASE,
        "estimated_rent": 999,
        "tenants": [{"label": "Unit A", "monthly_rent": 1000}],
    }
    res = client.post("/properties", json=payload, headers=auth_headers)
    assert res.json()["estimated_rent"] == 1000


def test_create_property_tenant_without_label_is_allowed(client, auth_headers):
    payload = {**BASE, "tenants": [{"monthly_rent": 1000}]}
    res = client.post("/properties", json=payload, headers=auth_headers)
    assert res.status_code == 200
    tenants = client.get(f"/properties/{res.json()['id']}/tenants", headers=auth_headers).json()
    assert len(tenants) == 1
    assert tenants[0]["label"] is None
    assert tenants[0]["monthly_rent"] == 1000


def test_update_property_replacing_tenants_recomputes_rent(client, auth_headers):
    create = client.post(
        "/properties",
        json={**BASE, "tenants": [{"label": "Unit A", "monthly_rent": 1000}]},
        headers=auth_headers,
    ).json()

    update = client.patch(
        f"/properties/{create['id']}",
        json={
            "tenants": [
                {"label": "Unit A", "monthly_rent": 1100},
                {"label": "Unit B", "monthly_rent": 900},
            ]
        },
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["estimated_rent"] == 2000

    tenants = client.get(f"/properties/{create['id']}/tenants", headers=auth_headers).json()
    assert len(tenants) == 2
    assert {t["label"] for t in tenants} == {"Unit A", "Unit B"}


def test_update_property_clearing_tenants_reverts_to_manual_rent(client, auth_headers):
    create = client.post(
        "/properties",
        json={**BASE, "tenants": [{"label": "Unit A", "monthly_rent": 1000}]},
        headers=auth_headers,
    ).json()

    update = client.patch(
        f"/properties/{create['id']}",
        json={"tenants": [], "estimated_rent": 1500},
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["estimated_rent"] == 1500

    tenants = client.get(f"/properties/{create['id']}/tenants", headers=auth_headers).json()
    assert tenants == []


def test_update_property_omitting_tenants_leaves_them_untouched(client, auth_headers):
    create = client.post(
        "/properties",
        json={**BASE, "tenants": [{"label": "Unit A", "monthly_rent": 1000}]},
        headers=auth_headers,
    ).json()

    update = client.patch(
        f"/properties/{create['id']}",
        json={"price": 210_000},
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["estimated_rent"] == 1000  # unchanged

    tenants = client.get(f"/properties/{create['id']}/tenants", headers=auth_headers).json()
    assert len(tenants) == 1


def test_delete_property_cascades_tenants(client, auth_headers, session):
    create = client.post(
        "/properties",
        json={**BASE, "tenants": [{"label": "Unit A", "monthly_rent": 1000}]},
        headers=auth_headers,
    ).json()

    res = client.delete(f"/properties/{create['id']}", headers=auth_headers)
    assert res.status_code == 200

    remaining = session.exec(select(Tenant).where(Tenant.property_id == create["id"])).all()
    assert remaining == []


def test_list_tenants_404s_for_property_in_another_workspace(client, auth_headers):
    create = client.post(
        "/properties",
        json={**BASE, "tenants": [{"label": "Unit A", "monthly_rent": 1000}]},
        headers=auth_headers,
    ).json()

    other_signup = client.post(
        "/auth/signup",
        json={
            "email": "other@example.com",
            "password": "password123",
            "first_name": "Other",
            "last_name": "User",
            "phone_number": "555-111-1111",
            "mode": "personal",
        },
    )
    other_headers = {"Authorization": f"Bearer {other_signup.json()['access_token']}"}

    res = client.get(f"/properties/{create['id']}/tenants", headers=other_headers)
    assert res.status_code == 404
