import secrets

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    rentcast_api_key: str = ""
    database_url: str = "sqlite:///./real_estate.db"
    cache_ttl_days: int = 7

    # Falls back to a random secret if unset, which invalidates tokens on
    # every restart — set SECRET_KEY in .env for a stable production value.
    secret_key: str = Field(default_factory=lambda: secrets.token_hex(32))
    access_token_expire_minutes: int = 60 * 24 * 7

    @property
    def rentcast_enabled(self) -> bool:
        return bool(self.rentcast_api_key)


settings = Settings()
