from bson import ObjectId
from fastapi import HTTPException
from app.database import members_collection, plans_collection
from datetime import datetime

def validate_object_id(id: str, field_name: str = "ID") -> ObjectId:
    """Validate if string is a valid MongoDB ObjectId"""
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
    return ObjectId(id)

def check_member_exists(member_id: str) -> dict:
    """Check if member exists and return member data"""
    obj_id = validate_object_id(member_id, "Member ID")
    member = members_collection.find_one({"_id": obj_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

def check_plan_exists(plan_id: str) -> dict:
    """Check if subscription plan exists and return plan data"""
    obj_id = validate_object_id(plan_id, "Plan ID")
    plan = plans_collection.find_one({"_id": obj_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    return plan

def validate_date_range(start_date: datetime, end_date: datetime):
    """Validate that end_date is after start_date"""
    if end_date <= start_date:
        raise HTTPException(
            status_code=400, 
            detail="End date must be after start date"
        )

def validate_phone_number(phone: str):
    """Basic phone number validation"""
    if not phone.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Phone number must contain only digits"
        )
    if len(phone) < 10 or len(phone) > 15:
        raise HTTPException(
            status_code=400,
            detail="Phone number must be between 10 and 15 digits"
        )

def calculate_subscription_end_date(start_date: datetime, duration_months: int) -> datetime:
    """Calculate end date based on start date and duration"""
    from dateutil.relativedelta import relativedelta
    return start_date + relativedelta(months=duration_months)