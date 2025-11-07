from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId

class SubscriptionPlanBase(BaseModel):
    plan_name: str = Field(..., min_length=2, max_length=50)
    duration_months: int = Field(..., ge=1, le=12)
    price: float = Field(..., ge=0)
    features: Optional[str] = None

class SubscriptionPlanCreate(SubscriptionPlanBase):
    pass

class SubscriptionPlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    duration_months: Optional[int] = None
    price: Optional[float] = None
    features: Optional[str] = None

class SubscriptionPlanResponse(SubscriptionPlanBase):
    id: str = Field(alias="_id")
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

# Member Subscription
class MemberSubscriptionBase(BaseModel):
    member_id: str
    plan_id: str
    start_date: datetime = Field(default_factory=datetime.now)
    end_date: datetime
    payment_amount: float = Field(..., ge=0)
    payment_mode: str = Field(..., pattern="^(Cash|Card|UPI|Net Banking)$")
    payment_date: datetime = Field(default_factory=datetime.now)
    status: str = Field(default="active", pattern="^(active|expired)$")

class MemberSubscriptionCreate(MemberSubscriptionBase):
    pass

class MemberSubscriptionResponse(MemberSubscriptionBase):
    id: str = Field(alias="_id")
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}