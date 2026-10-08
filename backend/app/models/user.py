import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def generate_invite_code() -> str:
    return secrets.token_hex(4).upper()


class Workspace(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    name: str
    is_personal: bool = False
    invite_code: str = Field(default_factory=generate_invite_code, unique=True, index=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    email: str = Field(unique=True, index=True)
    hashed_password: str
    first_name: str
    last_name: str
    phone_number: str
    workspace_id: int = Field(foreign_key="workspace.id", index=True)

    # "admin" is whoever created the workspace (personal or group) and always has
    # full permissions. "member" is someone who joined a group via invite code —
    # they start view-only until an admin grants can_edit_properties.
    role: str = Field(default="member")
    can_edit_properties: bool = Field(default=False)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
