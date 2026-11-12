"""Persistence model (Data tier). Works on SQLite (dev) and PostgreSQL (prod)."""
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    plan: Mapped[str] = mapped_column(String(20), default="trial")  # trial | free | premium
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    alerts: Mapped[list["Alert"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    watchlist: Mapped[list["WatchItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class ConflictEvent(Base):
    __tablename__ = "conflict_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    region: Mapped[str] = mapped_column(String(60), index=True)
    country: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String(40), index=True)
    fatalities: Mapped[int] = mapped_column(Integer, default=0)
    scope: Mapped[str] = mapped_column(String(20), default="regional")  # local | regional | global
    escalating: Mapped[bool] = mapped_column(Boolean, default=False)
    chokepoint: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(80), default="Sample feed")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | pending


class MarketBar(Base):
    __tablename__ = "market_bars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(16), default="SPX", index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    close: Mapped[float] = mapped_column(Float)


class ArchiveEpisode(Base):
    __tablename__ = "archive_episodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    start_date: Mapped[date] = mapped_column(Date)
    region: Mapped[str] = mapped_column(String(60))
    category: Mapped[str] = mapped_column(String(40))
    peak_severity: Mapped[float] = mapped_column(Float)
    pre_vol: Mapped[float] = mapped_column(Float)
    peak_vol: Mapped[float] = mapped_column(Float)
    days_to_peak: Mapped[int] = mapped_column(Integer)
    days_to_normalize: Mapped[int] = mapped_column(Integer)
    sp_move_pct: Mapped[float] = mapped_column(Float)
    summary: Mapped[str] = mapped_column(Text)
    sectors_hit: Mapped[list] = mapped_column(JSON, default=list)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    target: Mapped[str] = mapped_column(String(60), default="S&P 500")  # "S&P 500" or a sector name
    metric: Mapped[str] = mapped_column(String(20))  # vol_1d | vol_1w | vol_1m | cri | exposure
    operator: Mapped[str] = mapped_column(String(10), default="above")  # above | below
    threshold: Mapped[float] = mapped_column(Float)
    channel: Mapped[str] = mapped_column(String(20), default="in_app")  # in_app | email
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_state: Mapped[bool] = mapped_column(Boolean, default=False)
    last_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="alerts")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    alert_id: Mapped[int | None] = mapped_column(ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(20), default="info")  # info | warning | critical
    channel: Mapped[str] = mapped_column(String(20), default="in_app")
    delivered: Mapped[str] = mapped_column(String(40), default="in_app")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="notifications")


class WatchItem(Base):
    """A ticker the user follows ("followed company" in the prototype)."""
    __tablename__ = "watch_items"
    __table_args__ = (UniqueConstraint("user_id", "ticker", name="uq_watch_user_ticker"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ticker: Mapped[str] = mapped_column(String(12))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="watchlist")
