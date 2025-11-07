from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.subscription_schema import (
    SubscriptionPlanCreate, SubscriptionPlanUpdate, SubscriptionPlanResponse,
    MemberSubscriptionCreate, MemberSubscriptionResponse
)
from app.database import database, plans_collection, member_subscriptions_collection, members_collection
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timedelta
from app.utils import validate_object_id, check_member_exists, check_plan_exists, validate_date_range, calculate_subscription_end_date

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

# Helper functions
def plan_helper(plan) -> dict:
    return {
        "_id": str(plan["_id"]),
        "plan_name": plan["plan_name"],
        "duration_months": plan["duration_months"],
        "price": plan["price"],
        "features": plan.get("features", "")
    }

def member_subscription_helper(subscription) -> dict:
    return {
        "_id": str(subscription["_id"]),
        "member_id": subscription["member_id"],
        "plan_id": subscription["plan_id"],
        "start_date": subscription["start_date"],
        "end_date": subscription["end_date"],
        "payment_amount": subscription["payment_amount"],
        "payment_mode": subscription["payment_mode"],
        "payment_date": subscription["payment_date"],
        "status": subscription["status"]
    }

# ============ SUBSCRIPTION PLANS ============

@router.post("/plans", response_model=SubscriptionPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(plan: SubscriptionPlanCreate):
    # Check if plan name already exists
    existing_plan = plans_collection.find_one({"plan_name": plan.plan_name})
    if existing_plan:
        raise HTTPException(
            status_code=400,
            detail=f"Plan with name '{plan.plan_name}' already exists"
        )
    
    if plan.price < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")
    
    if plan.duration_months < 1:
        raise HTTPException(status_code=400, detail="Duration must be at least 1 month")
    
    plan_dict = plan.model_dump()
    result = plans_collection.insert_one(plan_dict)
    created_plan = plans_collection.find_one({"_id": result.inserted_id})
    return plan_helper(created_plan)

@router.get("/plans", response_model=List[SubscriptionPlanResponse])
async def get_all_plans():
    plans = []
    for plan in plans_collection.find().sort("price", 1):
        plans.append(plan_helper(plan))
    return plans

@router.get("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def get_plan(plan_id: str):
    obj_id = validate_object_id(plan_id, "Plan ID")
    plan = plans_collection.find_one({"_id": obj_id})
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return plan_helper(plan)

@router.put("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_plan(plan_id: str, plan_update: SubscriptionPlanUpdate):
    obj_id = validate_object_id(plan_id, "Plan ID")
    
    # Check if plan exists
    existing_plan = plans_collection.find_one({"_id": obj_id})
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    update_data = {k: v for k, v in plan_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Validate price if being updated
    if "price" in update_data and update_data["price"] < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")
    
    # Validate duration if being updated
    if "duration_months" in update_data and update_data["duration_months"] < 1:
        raise HTTPException(status_code=400, detail="Duration must be at least 1 month")
    
    # Check if new plan name already exists (for different plan)
    if "plan_name" in update_data:
        duplicate_plan = plans_collection.find_one({
            "plan_name": update_data["plan_name"],
            "_id": {"$ne": obj_id}
        })
        if duplicate_plan:
            raise HTTPException(
                status_code=400,
                detail=f"Plan with name '{update_data['plan_name']}' already exists"
            )
    
    result = plans_collection.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )
    
    updated_plan = plans_collection.find_one({"_id": obj_id})
    return plan_helper(updated_plan)

@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(plan_id: str):
    obj_id = validate_object_id(plan_id, "Plan ID")
    
    # Check if plan exists
    plan = plans_collection.find_one({"_id": obj_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Check if plan is being used by any active subscriptions
    active_subscriptions = member_subscriptions_collection.find_one({
        "plan_id": plan_id,
        "status": "active"
    })
    
    if active_subscriptions:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete plan with active subscriptions"
        )
    
    plans_collection.delete_one({"_id": obj_id})
    return None

# ============ MEMBER SUBSCRIPTIONS ============

@router.post("/member-subscriptions", response_model=MemberSubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_member_subscription(subscription: MemberSubscriptionCreate):
    # Check if member exists
    member = check_member_exists(subscription.member_id)
    
    # Check if plan exists
    plan = check_plan_exists(subscription.plan_id)
    
    # Validate date range
    validate_date_range(subscription.start_date, subscription.end_date)
    
    # Check if payment amount matches plan price (with some tolerance)
    if abs(subscription.payment_amount - plan["price"]) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({subscription.payment_amount}) doesn't match plan price ({plan['price']})"
        )
    
    # Check if member already has an active subscription
    existing_active = member_subscriptions_collection.find_one({
        "member_id": subscription.member_id,
        "status": "active"
    })
    
    if existing_active:
        raise HTTPException(
            status_code=400,
            detail="Member already has an active subscription. Please expire it first."
        )
    
    subscription_dict = subscription.model_dump()
    result = member_subscriptions_collection.insert_one(subscription_dict)
    
    # Update member status to active
    members_collection.update_one(
        {"_id": ObjectId(subscription.member_id)},
        {"$set": {"status": "active"}}
    )
    
    created_subscription = member_subscriptions_collection.find_one({"_id": result.inserted_id})
    return member_subscription_helper(created_subscription)

@router.get("/member-subscriptions", response_model=List[MemberSubscriptionResponse])
async def get_all_member_subscriptions(
    member_id: Optional[str] = None,
    status: Optional[str] = Query(None, pattern="^(active|expired)$")
):
    query = {}
    
    if member_id:
        # Validate member exists
        check_member_exists(member_id)
        query["member_id"] = member_id
    
    if status:
        query["status"] = status
    
    subscriptions = []
    for sub in member_subscriptions_collection.find(query).sort("start_date", -1):
        subscriptions.append(member_subscription_helper(sub))
    return subscriptions

@router.get("/member-subscriptions/{subscription_id}", response_model=MemberSubscriptionResponse)
async def get_member_subscription(subscription_id: str):
    obj_id = validate_object_id(subscription_id, "Subscription ID")
    subscription = member_subscriptions_collection.find_one({"_id": obj_id})
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return member_subscription_helper(subscription)

@router.put("/member-subscriptions/{subscription_id}/renew", response_model=MemberSubscriptionResponse)
async def renew_subscription(subscription_id: str):
    """Renew an expired subscription"""
    obj_id = validate_object_id(subscription_id, "Subscription ID")
    
    subscription = member_subscriptions_collection.find_one({"_id": obj_id})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    if subscription["status"] != "expired":
        raise HTTPException(
            status_code=400,
            detail="Only expired subscriptions can be renewed"
        )
    
    # Get plan details
    plan = check_plan_exists(subscription["plan_id"])
    
    # Calculate new dates
    new_start_date = datetime.now()
    new_end_date = calculate_subscription_end_date(new_start_date, plan["duration_months"])
    
    # Update subscription
    member_subscriptions_collection.update_one(
        {"_id": obj_id},
        {"$set": {
            "start_date": new_start_date,
            "end_date": new_end_date,
            "payment_date": new_start_date,
            "status": "active"
        }}
    )
    
    # Update member status
    members_collection.update_one(
        {"_id": ObjectId(subscription["member_id"])},
        {"$set": {"status": "active"}}
    )
    
    updated_subscription = member_subscriptions_collection.find_one({"_id": obj_id})
    return member_subscription_helper(updated_subscription)

@router.put("/member-subscriptions/{subscription_id}/expire", response_model=MemberSubscriptionResponse)
async def expire_subscription(subscription_id: str):
    """Manually expire a subscription"""
    obj_id = validate_object_id(subscription_id, "Subscription ID")
    
    subscription = member_subscriptions_collection.find_one({"_id": obj_id})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    if subscription["status"] == "expired":
        raise HTTPException(status_code=400, detail="Subscription is already expired")
    
    # Expire subscription
    member_subscriptions_collection.update_one(
        {"_id": obj_id},
        {"$set": {"status": "expired"}}
    )
    
    # Update member status
    members_collection.update_one(
        {"_id": ObjectId(subscription["member_id"])},
        {"$set": {"status": "expired"}}
    )
    
    updated_subscription = member_subscriptions_collection.find_one({"_id": obj_id})
    return member_subscription_helper(updated_subscription)

@router.delete("/member-subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member_subscription(subscription_id: str):
    obj_id = validate_object_id(subscription_id, "Subscription ID")
    
    subscription = member_subscriptions_collection.find_one({"_id": obj_id})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    result = member_subscriptions_collection.delete_one({"_id": obj_id})
    return None

@router.get("/expiring-soon")
async def get_expiring_subscriptions(days: int = Query(7, ge=1, le=30)):
    """Get subscriptions expiring within specified days"""
    from datetime import timedelta
    
    end_date_threshold = datetime.now() + timedelta(days=days)
    
    expiring_subs = list(member_subscriptions_collection.find({
        "status": "active",
        "end_date": {"$lte": end_date_threshold, "$gte": datetime.now()}
    }).sort("end_date", 1))
    
    # Get member details for each subscription
    result = []
    for sub in expiring_subs:
        member = members_collection.find_one({"_id": ObjectId(sub["member_id"])})
        plan = plans_collection.find_one({"_id": ObjectId(sub["plan_id"])})
        
        result.append({
            "subscription_id": str(sub["_id"]),
            "member_name": member["name"] if member else "Unknown",
            "member_email": member["email"] if member else "Unknown",
            "plan_name": plan["plan_name"] if plan else "Unknown",
            "end_date": sub["end_date"],
            "days_remaining": (sub["end_date"] - datetime.now()).days
        })
    
    return result