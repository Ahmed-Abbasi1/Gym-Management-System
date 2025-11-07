from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.attendance_schema import (
    AttendanceCreate, AttendanceCheckout, AttendanceResponse,
    WorkoutPlanCreate, WorkoutPlanUpdate, WorkoutPlanResponse
)
from app.database import database, attendance_collection, workout_plans_collection, members_collection
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timedelta
from app.utils import validate_object_id, check_member_exists

router = APIRouter(prefix="/attendance", tags=["Attendance & Workout"])

# Helper functions
def attendance_helper(attendance) -> dict:
    return {
        "_id": str(attendance["_id"]),
        "member_id": attendance["member_id"],
        "check_in_time": attendance["check_in_time"],
        "check_out_time": attendance.get("check_out_time"),
        "date": attendance["date"]
    }

def workout_plan_helper(plan) -> dict:
    return {
        "_id": str(plan["_id"]),
        "member_id": plan["member_id"],
        "plan_name": plan["plan_name"],
        "exercises": plan["exercises"],
        "created_date": plan["created_date"],
        "trainer_name": plan.get("trainer_name")
    }

# ============ ATTENDANCE ============

@router.post("/check-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def check_in(attendance: AttendanceCreate):
    # Check if member exists
    member = check_member_exists(attendance.member_id)
    
    # Check if member has active subscription
    if member.get("status") not in ["active"]:
        raise HTTPException(
            status_code=400,
            detail=f"Member status is '{member.get('status')}'. Only active members can check in."
        )
    
    # Check if member already checked in today without checking out
    today = datetime.now().strftime("%Y-%m-%d")
    existing_attendance = attendance_collection.find_one({
        "member_id": attendance.member_id,
        "date": today,
        "check_out_time": None
    })
    
    if existing_attendance:
        raise HTTPException(
            status_code=400,
            detail="Member is already checked in. Please check out first."
        )
    
    attendance_dict = {
        "member_id": attendance.member_id,
        "check_in_time": datetime.now(),
        "check_out_time": None,
        "date": today
    }
    
    result = attendance_collection.insert_one(attendance_dict)
    created_attendance = attendance_collection.find_one({"_id": result.inserted_id})
    return attendance_helper(created_attendance)

@router.put("/check-out/{attendance_id}", response_model=AttendanceResponse)
async def check_out(attendance_id: str):
    obj_id = validate_object_id(attendance_id, "Attendance ID")
    
    attendance = attendance_collection.find_one({"_id": obj_id})
    
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    if attendance.get("check_out_time"):
        raise HTTPException(
            status_code=400,
            detail=f"Already checked out at {attendance['check_out_time']}"
        )
    
    checkout_time = datetime.now()
    
    # Validate check-out time is after check-in time
    if checkout_time < attendance["check_in_time"]:
        raise HTTPException(
            status_code=400,
            detail="Check-out time cannot be before check-in time"
        )
    
    result = attendance_collection.update_one(
        {"_id": obj_id},
        {"$set": {"check_out_time": checkout_time}}
    )
    
    updated_attendance = attendance_collection.find_one({"_id": obj_id})
    return attendance_helper(updated_attendance)

@router.get("/stats/today")
async def get_today_stats():
    """Get attendance statistics for today"""
    today = datetime.now().strftime("%Y-%m-%d")
    
    total_checkins = attendance_collection.count_documents({"date": today})
    active_now = attendance_collection.count_documents({
        "date": today,
        "check_out_time": None
    })
    completed = attendance_collection.count_documents({
        "date": today,
        "check_out_time": {"$ne": None}
    })
    
    return {
        "date": today,
        "total_check_ins": total_checkins,
        "currently_in_gym": active_now,
        "completed_sessions": completed
    }

# ============ WORKOUT PLANS ============
# IMPORTANT: These routes must come BEFORE the generic /{attendance_id} route

@router.post("/workout-plans", response_model=WorkoutPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_plan(plan: WorkoutPlanCreate):
    # Check if member exists
    check_member_exists(plan.member_id)
    
    plan_dict = plan.model_dump()
    result = workout_plans_collection.insert_one(plan_dict)
    created_plan = workout_plans_collection.find_one({"_id": result.inserted_id})
    return workout_plan_helper(created_plan)

@router.get("/workout-plans", response_model=List[WorkoutPlanResponse])
async def get_workout_plans(member_id: Optional[str] = None):
    query = {}
    
    if member_id:
        # Validate member exists
        check_member_exists(member_id)
        query["member_id"] = member_id
    
    plans = []
    for plan in workout_plans_collection.find(query).sort("created_date", -1):
        plans.append(workout_plan_helper(plan))
    return plans

@router.get("/workout-plans/{plan_id}", response_model=WorkoutPlanResponse)
async def get_workout_plan(plan_id: str):
    obj_id = validate_object_id(plan_id, "Workout Plan ID")
    
    plan = workout_plans_collection.find_one({"_id": obj_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Workout plan not found")
    
    return workout_plan_helper(plan)

@router.put("/workout-plans/{plan_id}", response_model=WorkoutPlanResponse)
async def update_workout_plan(plan_id: str, plan_update: WorkoutPlanUpdate):
    obj_id = validate_object_id(plan_id, "Workout Plan ID")
    
    # Check if plan exists
    existing_plan = workout_plans_collection.find_one({"_id": obj_id})
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Workout plan not found")
    
    update_data = {k: v for k, v in plan_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = workout_plans_collection.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    updated_plan = workout_plans_collection.find_one({"_id": obj_id})
    return workout_plan_helper(updated_plan)

@router.delete("/workout-plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout_plan(plan_id: str):
    obj_id = validate_object_id(plan_id, "Workout Plan ID")
    
    plan = workout_plans_collection.find_one({"_id": obj_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Workout plan not found")
    
    result = workout_plans_collection.delete_one({"_id": obj_id})
    return None

# ============ ATTENDANCE RECORDS (Generic routes at the end) ============

@router.get("/", response_model=List[AttendanceResponse])
async def get_attendance(
    member_id: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = {}
    
    if member_id:
        # Validate member exists
        check_member_exists(member_id)
        query["member_id"] = member_id
    
    if date:
        query["date"] = date
    elif start_date and end_date:
        # Date range query
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    attendance_records = []
    for record in attendance_collection.find(query).sort("check_in_time", -1):
        attendance_records.append(attendance_helper(record))
    return attendance_records

@router.get("/{attendance_id}", response_model=AttendanceResponse)
async def get_attendance_by_id(attendance_id: str):
    obj_id = validate_object_id(attendance_id, "Attendance ID")
    
    attendance = attendance_collection.find_one({"_id": obj_id})
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    return attendance_helper(attendance)

@router.delete("/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance(attendance_id: str):
    """Delete an attendance record (admin only)"""
    obj_id = validate_object_id(attendance_id, "Attendance ID")
    
    attendance = attendance_collection.find_one({"_id": obj_id})
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    attendance_collection.delete_one({"_id": obj_id})
    return None