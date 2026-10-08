from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.property import Property, Tenant
from app.models.user import User
from app.schemas.property import PropertyCreate, PropertyUpdate
from app.services import rentcast

router = APIRouter(prefix="/properties", tags=["properties"])


def _get_owned_property(session: Session, current_user: User, property_id: int) -> Property:
    prop = session.get(Property, property_id)
    if not prop or prop.workspace_id != current_user.workspace_id:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


def _require_edit_permission(current_user: User) -> None:
    if current_user.role != "admin" and not current_user.can_edit_properties:
        raise HTTPException(
            status_code=403,
            detail="You have view-only access. Ask your workspace admin for permission to add or delete properties.",
        )


@router.get("", response_model=list[Property])
def list_properties(
    session: Session = Depends(get_session), current_user: User = Depends(get_current_user)
):
    return session.exec(
        select(Property).where(Property.workspace_id == current_user.workspace_id)
    ).all()


@router.post("", response_model=Property)
def create_property(
    payload: PropertyCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_edit_permission(current_user)
    tenants = payload.tenants or []
    data = payload.model_dump(exclude={"auto_fetch_market_data", "tenants"})
    if tenants:
        data["estimated_rent"] = sum(t.monthly_rent for t in tenants)
    prop = Property(**data, workspace_id=current_user.workspace_id)

    if payload.auto_fetch_market_data:
        try:
            market = rentcast.get_market_data(
                session, prop.address, prop.city, prop.state, prop.zip_code
            )
            if market["value_estimate"]:
                prop.estimated_value = market["value_estimate"]
            if market["rent_estimate"] and not tenants:
                prop.estimated_rent = market["rent_estimate"]
        except rentcast.RentCastError as e:
            raise HTTPException(status_code=502, detail=str(e))

    session.add(prop)
    session.commit()
    session.refresh(prop)

    for t in tenants:
        session.add(Tenant(property_id=prop.id, label=t.label, monthly_rent=t.monthly_rent))
    if tenants:
        session.commit()
        session.refresh(prop)

    return prop


@router.get("/{property_id}", response_model=Property)
def get_property(
    property_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_property(session, current_user, property_id)


@router.patch("/{property_id}", response_model=Property)
def update_property(
    property_id: int,
    payload: PropertyUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_edit_permission(current_user)
    prop = _get_owned_property(session, current_user, property_id)

    update_data = payload.model_dump(exclude_unset=True)
    tenants = update_data.pop("tenants", None)

    for field, value in update_data.items():
        setattr(prop, field, value)

    if tenants is not None:
        existing_tenants = session.exec(
            select(Tenant).where(Tenant.property_id == property_id)
        ).all()
        for t in existing_tenants:
            session.delete(t)
        for t in tenants:
            session.add(
                Tenant(property_id=property_id, label=t.get("label"), monthly_rent=t["monthly_rent"])
            )
        if tenants:
            prop.estimated_rent = sum(t["monthly_rent"] for t in tenants)

    prop.updated_at = datetime.now(timezone.utc)

    session.add(prop)
    session.commit()
    session.refresh(prop)
    return prop


@router.get("/{property_id}/tenants", response_model=list[Tenant])
def list_tenants(
    property_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _get_owned_property(session, current_user, property_id)
    return session.exec(select(Tenant).where(Tenant.property_id == property_id)).all()


@router.delete("/{property_id}")
def delete_property(
    property_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_edit_permission(current_user)
    prop = _get_owned_property(session, current_user, property_id)
    for t in session.exec(select(Tenant).where(Tenant.property_id == property_id)).all():
        session.delete(t)
    session.delete(prop)
    session.commit()
    return {"ok": True}


@router.post("/{property_id}/refresh-market-data", response_model=Property)
def refresh_market_data(
    property_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_edit_permission(current_user)
    prop = _get_owned_property(session, current_user, property_id)

    try:
        market = rentcast.get_market_data(
            session, prop.address, prop.city, prop.state, prop.zip_code
        )
    except rentcast.RentCastError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if market["value_estimate"]:
        prop.estimated_value = market["value_estimate"]
    if market["rent_estimate"]:
        prop.estimated_rent = market["rent_estimate"]
    prop.updated_at = datetime.now(timezone.utc)

    session.add(prop)
    session.commit()
    session.refresh(prop)
    return prop
