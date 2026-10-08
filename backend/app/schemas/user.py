from typing import Literal, Optional

from pydantic import BaseModel


class SignupRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    phone_number: str
    mode: Literal["personal", "create_group", "join_group"]
    group_name: Optional[str] = None
    invite_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class WorkspaceRead(BaseModel):
    id: int
    name: str
    is_personal: bool
    invite_code: str


class UserRead(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    phone_number: str
    role: str
    can_edit_properties: bool
    workspace: WorkspaceRead


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class WorkspaceMemberRead(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: str
    can_edit_properties: bool


class MemberPermissionUpdate(BaseModel):
    can_edit_properties: bool
