from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.schemas.auth_schema import UserLogin, UserRegister, Token
from app.database import users_collection, members_collection
from app.auth import (
    get_password_hash, 
    authenticate_user, 
    create_access_token,
    get_current_user,
    get_current_admin
)
from datetime import timedelta, datetime
from app.config import settings
from bson import ObjectId

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user: UserRegister):
    """Register a new user (admin only for creating admin accounts)"""
    
    # Check if email already exists
    existing_user = users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # For member registration, check if member exists
    if user.role == "member":
        member = members_collection.find_one({"email": user.email})
        if not member:
            raise HTTPException(
                status_code=400,
                detail="No member found with this email. Please contact admin."
            )
        member_id = str(member["_id"])
    else:
        member_id = None
    
    # Hash password
    hashed_password = get_password_hash(user.password)
    
    # Create user
    user_dict = {
        "email": user.email,
        "password": hashed_password,
        "name": user.name,
        "role": user.role,
        "member_id": member_id,
        "created_at": datetime.now()
    }
    
    result = users_collection.insert_one(user_dict)
    
    return {
        "message": "User registered successfully",
        "email": user.email,
        "role": user.role
    }

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login user and return JWT token"""
    
    user = authenticate_user(form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=int(settings.access_token_expire_minutes))
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "user_id": str(user["_id"]),
        "name": user["name"]
    }

@router.post("/login-json")
async def login_json(credentials: UserLogin):
    """Login with JSON body (alternative to form-data)"""
    
    user = authenticate_user(credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=int(settings.access_token_expire_minutes))
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "user_id": str(user["_id"]),
        "name": user["name"]
    }

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current logged-in user information"""
    
    user_info = {
        "user_id": str(current_user["_id"]),
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"]
    }
    
    # If user is a member, get member details
    if current_user["role"] == "member" and current_user.get("member_id"):
        member = members_collection.find_one({"_id": ObjectId(current_user["member_id"])})
        if member:
            user_info["member_id"] = str(member["_id"])  # This is the actual member ID
            user_info["member_details"] = {
                "phone": member.get("phone"),
                "age": member.get("age"),
                "gender": member.get("gender"),
                "status": member.get("status"),
                "join_date": member.get("join_date")
            }
    
    return user_info

@router.post("/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    current_user: dict = Depends(get_current_user)
):
    """Change user password"""
    
    # Verify old password
    from app.auth import verify_password
    if not verify_password(old_password, current_user["password"]):
        raise HTTPException(
            status_code=400,
            detail="Incorrect current password"
        )
    
    # Update password
    hashed_password = get_password_hash(new_password)
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password": hashed_password}}
    )
    
    return {"message": "Password changed successfully"}

@router.post("/create-admin")
async def create_admin_user():
    """Create initial admin user - USE ONCE ONLY"""
    
    # Check if admin already exists
    existing_admin = users_collection.find_one({"role": "admin"})
    if existing_admin:
        raise HTTPException(
            status_code=400,
            detail="Admin user already exists"
        )
    
    # Create default admin
    admin_user = {
        "email": "admin@gym.com",
        "password": get_password_hash("admin123"),
        "name": "Admin User",
        "role": "admin",
        "member_id": None,
        "created_at": datetime.now()
    }
    
    users_collection.insert_one(admin_user)
    
    return {
        "message": "Admin user created successfully",
        "email": "admin@gym.com",
        "password": "admin123",
        "note": "Please change the password after first login"
    }

@router.post("/register-member", status_code=status.HTTP_201_CREATED)
async def register_member_self(email: str, password: str, confirm_password: str):
    """Allow existing gym members to create login credentials"""
    
    # Validate passwords match
    if password != confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )
    
    # Check if password is strong enough
    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long"
        )
    
    # Check if user already exists
    existing_user = users_collection.find_one({"email": email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Login credentials already exist for this email"
        )
    
    # Check if member exists in members collection
    member = members_collection.find_one({"email": email})
    if not member:
        raise HTTPException(
            status_code=400,
            detail="No member found with this email. Please contact gym admin."
        )
    
    # Hash password
    hashed_password = get_password_hash(password)
    
    # Create user account
    user_dict = {
        "email": email,
        "password": hashed_password,
        "name": member["name"],
        "role": "member",
        "member_id": str(member["_id"]),
        "created_at": datetime.now()
    }
    
    users_collection.insert_one(user_dict)
    
    return {
        "message": "Registration successful! You can now login.",
        "email": email
    }