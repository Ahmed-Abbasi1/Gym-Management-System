from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.member_schema import MemberCreate, MemberUpdate, MemberResponse
from app.database import members_collection, member_subscriptions_collection, attendance_collection
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from app.utils import validate_object_id, validate_phone_number

router = APIRouter(prefix="/members", tags=["Members"])

def member_helper(member) -> dict:
    return {
        "_id": str(member["_id"]),
        "name": member["name"],
        "email": member["email"],
        "phone": member["phone"],
        "age": member["age"],
        "gender": member["gender"],
        "address": member["address"],
        "emergency_contact": member["emergency_contact"],
        "join_date": member["join_date"],
        "status": member["status"]
    }

@router.post("/", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(member: MemberCreate):
    # Validate phone numbers
    validate_phone_number(member.phone)
    validate_phone_number(member.emergency_contact)
    
    # Check if email already exists
    existing_member = members_collection.find_one({"email": member.email})
    if existing_member:
        raise HTTPException(
            status_code=400, 
            detail=f"Email '{member.email}' is already registered"
        )
    
    # Check if phone already exists
    existing_phone = members_collection.find_one({"phone": member.phone})
    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail=f"Phone number '{member.phone}' is already registered"
        )
    
    member_dict = member.model_dump()
    result = members_collection.insert_one(member_dict)
    created_member = members_collection.find_one({"_id": result.inserted_id})
    return member_helper(created_member)

@router.get("/", response_model=List[MemberResponse])
async def get_all_members(
    status: Optional[str] = Query(None, pattern="^(active|inactive|expired)$"),
    gender: Optional[str] = Query(None, pattern="^(Male|Female|Other)$"),
    search: Optional[str] = None
):
    query = {}
    
    # Filter by status
    if status:
        query["status"] = status
    
    # Filter by gender
    if gender:
        query["gender"] = gender
    
    # Search by name, email, or phone
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    members = []
    for member in members_collection.find(query).sort("join_date", -1):
        members.append(member_helper(member))
    return members

@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(member_id: str):
    obj_id = validate_object_id(member_id, "Member ID")
    member = members_collection.find_one({"_id": obj_id})
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    return member_helper(member)

@router.put("/{member_id}", response_model=MemberResponse)
async def update_member(member_id: str, member_update: MemberUpdate):
    obj_id = validate_object_id(member_id, "Member ID")
    
    # Check if member exists
    existing_member = members_collection.find_one({"_id": obj_id})
    if not existing_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    update_data = {k: v for k, v in member_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Validate phone if being updated
    if "phone" in update_data:
        validate_phone_number(update_data["phone"])
        # Check if new phone already exists (for different member)
        existing_phone = members_collection.find_one({
            "phone": update_data["phone"],
            "_id": {"$ne": obj_id}
        })
        if existing_phone:
            raise HTTPException(
                status_code=400,
                detail=f"Phone number '{update_data['phone']}' is already registered"
            )
    
    # Validate emergency contact if being updated
    if "emergency_contact" in update_data:
        validate_phone_number(update_data["emergency_contact"])
    
    # Validate email if being updated
    if "email" in update_data:
        existing_email = members_collection.find_one({
            "email": update_data["email"],
            "_id": {"$ne": obj_id}
        })
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail=f"Email '{update_data['email']}' is already registered"
            )
    
    result = members_collection.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    updated_member = members_collection.find_one({"_id": obj_id})
    return member_helper(updated_member)

@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(member_id: str):
    obj_id = validate_object_id(member_id, "Member ID")
    
    # Check if member exists
    member = members_collection.find_one({"_id": obj_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Check for active subscriptions
    active_subscription = member_subscriptions_collection.find_one({
        "member_id": member_id,
        "status": "active"
    })
    
    if active_subscription:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete member with active subscription. Please expire the subscription first."
        )
    
    # Delete member's data (cascade delete)
    member_subscriptions_collection.delete_many({"member_id": member_id})
    attendance_collection.delete_many({"member_id": member_id})
    
    # Delete member
    members_collection.delete_one({"_id": obj_id})
    
    return None

@router.get("/{member_id}/subscriptions")
async def get_member_subscriptions(member_id: str):
    """Get all subscriptions for a specific member"""
    obj_id = validate_object_id(member_id, "Member ID")
    
    # Check if member exists
    member = members_collection.find_one({"_id": obj_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    subscriptions = list(member_subscriptions_collection.find({"member_id": member_id}))
    
    # Convert ObjectId to string
    for sub in subscriptions:
        sub["_id"] = str(sub["_id"])
    
    return subscriptions

@router.get("/{member_id}/attendance-history")
async def get_member_attendance(member_id: str):
    """Get attendance history for a specific member"""
    obj_id = validate_object_id(member_id, "Member ID")
    
    # Check if member exists
    member = members_collection.find_one({"_id": obj_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    attendance_records = list(
        attendance_collection.find({"member_id": member_id}).sort("check_in_time", -1)
    )
    
    # Convert ObjectId to string
    for record in attendance_records:
        record["_id"] = str(record["_id"])
    
    return attendance_records