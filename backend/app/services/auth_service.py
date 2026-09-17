from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from typing import Optional

from app.core.config import settings
from app.core.security import verify_password, get_password_hash
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import UserCreate, TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user_in: UserCreate) -> User:
    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def get_or_create_default_user(db: Session) -> User:
    guest_email = "guest@agenticdebate.io"
    user = get_user_by_email(db, guest_email)
    if not user:
        user = User(
            email=guest_email,
            hashed_password=get_password_hash("guestpass123"),
            full_name="Guest Researcher"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def get_current_user(db: Session = Depends(get_db), token: Optional[str] = Depends(oauth2_scheme)) -> User:
    if not token:
        return get_or_create_default_user(db)
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return get_or_create_default_user(db)
        token_data = TokenData(sub=email)
    except JWTError:
        return get_or_create_default_user(db)
    
    user = get_user_by_email(db, email=token_data.sub)
    if user is None:
        return get_or_create_default_user(db)
    return user
