from pydantic import BaseModel


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    sub: str
    role: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
