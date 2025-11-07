from pydantic import BaseModel, EmailStr
from typing import Optional

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "member"  # "admin" or "member"

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: str
    name: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None