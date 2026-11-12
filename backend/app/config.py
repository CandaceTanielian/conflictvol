"""Application settings, read from environment variables.

Local development runs on SQLite with seeded sample data. Production points
DATABASE_URL at PostgreSQL and supplies API keys so the ingestion adapters
pull live conflict and market data instead of the sample feed.
"""
import os
from dataclasses import dataclass, field


def _list(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "ConflictVol"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./conflictvol.db")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-change-me")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))
    cors_origins: list[str] = field(
        default_factory=lambda: _list(
            os.getenv("CORS_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081,http://localhost:8082,http://localhost:19006,http://localhost:5173")
        )
    )
    # External data providers (optional). Without keys the sample feed is used.
    acled_api_key: str | None = os.getenv("ACLED_API_KEY")
    acled_email: str | None = os.getenv("ACLED_EMAIL")
    alphavantage_api_key: str | None = os.getenv("ALPHAVANTAGE_API_KEY")
    # Notification gateway (optional). Without SMTP, email alerts are logged.
    smtp_host: str | None = os.getenv("SMTP_HOST")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str | None = os.getenv("SMTP_USER")
    smtp_password: str | None = os.getenv("SMTP_PASSWORD")
    smtp_from: str = os.getenv("SMTP_FROM", "alerts@conflictvol.app")
    trial_days: int = 14


settings = Settings()
