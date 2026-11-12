"""UC: Register / Log In."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Notification, User
from ..schemas import LoginIn, RegisterIn
from ..security import create_access_token, effective_plan, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_view(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "plan": u.plan,
        "effective_plan": effective_plan(u),
        "trial_ends_at": u.trial_ends_at.isoformat() if u.trial_ends_at else None,
        "email_alerts": u.email_alerts,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(409, "An account with this email already exists. Try signing in instead.")
    now = datetime.now(timezone.utc)
    u = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password), plan="trial",
             trial_ends_at=now + timedelta(days=settings.trial_days))
    db.add(u)
    db.flush()
    db.add(Notification(user_id=u.id, title="Welcome to ConflictVol",
                        body="Your 14-day Premium trial is active: real-time projections, the full archive, and custom alerts. "
                             "Start by setting an alert on the volatility level that matters to you.",
                        level="info"))
    db.commit()
    db.refresh(u)
    return {"access_token": create_access_token(u.id), "token_type": "bearer", "user": user_view(u)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    return {"access_token": create_access_token(u.id), "token_type": "bearer", "user": user_view(u)}


@router.post("/login-form", include_in_schema=False)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 password flow for the interactive /docs page."""
    return login(LoginIn(email=form.username, password=form.password), db)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_view(user)
