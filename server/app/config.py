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

    # --- Email / SMTP (notification engine, spec §5.6) ---
    # When smtp_host is empty the mailer logs the rendered email to the console
    # instead of sending — so notifications are verifiable in dev without a mail
    # server. Set these to deliver for real. A mail failure never breaks the
    # underlying action (publish/close/etc.); sends run in a background task.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "SWAN Alerts <no-reply@aglgroup.com>"
    smtp_starttls: bool = True
    # Base URL used to build the deep links embedded in emails.
    app_base_url: str = "http://localhost:5173"


settings = Settings()
