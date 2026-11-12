from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AlertIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target: str = "S&P 500"
    metric: Literal["vol_1d", "vol_1w", "vol_1m", "cri", "exposure"]
    operator: Literal["above", "below"] = "above"
    threshold: float = Field(gt=0, le=200)
    channel: Literal["in_app", "email"] = "in_app"
    active: bool = True


class AlertPatch(BaseModel):
    name: str | None = None
    threshold: float | None = Field(default=None, gt=0, le=200)
    operator: Literal["above", "below"] | None = None
    channel: Literal["in_app", "email"] | None = None
    active: bool | None = None


class AccountPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email_alerts: bool | None = None


class PlanIn(BaseModel):
    plan: Literal["free", "premium"]
