from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./swan.db"
    secret_key: str = "dev-secret-change-me"
    session_ttl_hours: int = 12
    frontend_origin: str = "http://localhost:5173"

    # Stubbed-SSO seam. When a real OIDC IdP is wired in Phase 1.5, these are the
    # only values that change; the login router swaps its dev endpoint for the
    # authorization-code flow. See app/routers/auth.py.
    oidc_enabled: bool = False


settings = Settings()
