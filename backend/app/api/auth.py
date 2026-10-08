from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.user import User, Workspace
from app.schemas.user import (
    LoginRequest,
    MemberPermissionUpdate,
    SignupRequest,
    TokenResponse,
    UserRead,
    WorkspaceMemberRead,
    WorkspaceRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_user_read(user: User, workspace: Workspace) -> UserRead:
    return UserRead(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone_number=user.phone_number,
        role=user.role,
        can_edit_properties=user.can_edit_properties,
        workspace=WorkspaceRead(
            id=workspace.id,
            name=workspace.name,
            is_personal=workspace.is_personal,
            invite_code=workspace.invite_code,
        ),
    )


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest, session: Session = Depends(get_session)):
    email = payload.email.strip().lower()
    if not email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(payload.password) < 10:
        raise HTTPException(status_code=400, detail="Password must be at least 10 characters long")
    if not payload.first_name.strip() or not payload.last_name.strip():
        raise HTTPException(status_code=400, detail="First and last name are required")
    if not payload.phone_number.strip():
        raise HTTPException(status_code=400, detail="Phone number is required")

    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with that email already exists")

    if payload.mode == "personal":
        workspace = Workspace(name=f"{email}'s workspace", is_personal=True)
        session.add(workspace)
        session.commit()
        session.refresh(workspace)
        role = "admin"
    elif payload.mode == "create_group":
        if not payload.group_name or not payload.group_name.strip():
            raise HTTPException(status_code=400, detail="Group name is required")
        workspace = Workspace(name=payload.group_name.strip(), is_personal=False)
        session.add(workspace)
        session.commit()
        session.refresh(workspace)
        role = "admin"
    elif payload.mode == "join_group":
        if not payload.invite_code or not payload.invite_code.strip():
            raise HTTPException(status_code=400, detail="Invite code is required")
        workspace = session.exec(
            select(Workspace).where(Workspace.invite_code == payload.invite_code.strip().upper())
        ).first()
        if not workspace:
            raise HTTPException(status_code=404, detail="No group found for that invite code")
        role = "member"
    else:
        raise HTTPException(status_code=400, detail="Invalid signup mode")

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        phone_number=payload.phone_number.strip(),
        workspace_id=workspace.id,
        role=role,
        can_edit_properties=(role == "admin"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=_to_user_read(user, workspace))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    email = payload.email.strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    workspace = session.get(Workspace, user.workspace_id)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=_to_user_read(user, workspace))


@router.get("/me", response_model=UserRead)
def me(
    current_user: User = Depends(get_current_user), session: Session = Depends(get_session)
):
    workspace = session.get(Workspace, current_user.workspace_id)
    return _to_user_read(current_user, workspace)


@router.get("/workspace/members", response_model=list[WorkspaceMemberRead])
def list_workspace_members(
    current_user: User = Depends(get_current_user), session: Session = Depends(get_session)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the workspace admin can view the team")

    members = session.exec(
        select(User).where(User.workspace_id == current_user.workspace_id)
    ).all()
    return [
        WorkspaceMemberRead(
            id=m.id,
            email=m.email,
            first_name=m.first_name,
            last_name=m.last_name,
            role=m.role,
            can_edit_properties=m.can_edit_properties,
        )
        for m in members
    ]


@router.patch("/workspace/members/{member_id}", response_model=WorkspaceMemberRead)
def update_member_permissions(
    member_id: int,
    payload: MemberPermissionUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the workspace admin can change permissions")

    member = session.get(User, member_id)
    if not member or member.workspace_id != current_user.workspace_id:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == "admin":
        raise HTTPException(status_code=400, detail="The admin always has full permissions")

    member.can_edit_properties = payload.can_edit_properties
    session.add(member)
    session.commit()
    session.refresh(member)

    return WorkspaceMemberRead(
        id=member.id,
        email=member.email,
        first_name=member.first_name,
        last_name=member.last_name,
        role=member.role,
        can_edit_properties=member.can_edit_properties,
    )
