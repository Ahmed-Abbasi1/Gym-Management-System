from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId

class AttendanceBase(BaseModel):
    member_id: str
    check_in_time: datetime = Field(default_factory=datetime.now)
    check_out_time: Optional[datetime] = None
    date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))

class AttendanceCreate(BaseModel):
    member_id: str

class AttendanceCheckout(BaseModel):
    check_out_time: datetime = Field(default_factory=datetime.now)

class AttendanceResponse(AttendanceBase):
    id: str = Field(alias="_id")
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

# Workout Plan
class WorkoutPlanBase(BaseModel):
    member_id: str
    plan_name: str = Field(..., min_length=2, max_length=100)
    exercises: str  # JSON string or text describing exercises
    created_date: datetime = Field(default_factory=datetime.now)
    trainer_name: Optional[str] = None

class WorkoutPlanCreate(WorkoutPlanBase):
    pass

class WorkoutPlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    exercises: Optional[str] = None
    trainer_name: Optional[str] = None

class WorkoutPlanResponse(WorkoutPlanBase):
    id: str = Field(alias="_id")
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}