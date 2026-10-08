from pathlib import Path

from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings

# SQLite relative paths (e.g. "sqlite:///./real_estate.db") resolve against the
# process's working directory, which differs depending on how uvicorn is
# launched — pin them to backend/ so the app always uses the same db file
# regardless of launch method.
database_url = settings.database_url
if database_url.startswith("sqlite:///./"):
    backend_dir = Path(__file__).resolve().parent.parent.parent
    db_path = backend_dir / database_url.removeprefix("sqlite:///./")
    database_url = f"sqlite:///{db_path}"

connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
