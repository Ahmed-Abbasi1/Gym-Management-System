from fastapi import APIRouter, HTTPException, Query
from app.database import (
    members_collection, 
    member_subscriptions_collection, 
    attendance_collection,
    plans_collection
)
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(prefix="/analytics", tags=["Analytics & Reports"])

# ============ DASHBOARD STATS ============

@router.get("/dashboard")
async def get_dashboard_stats():
    """Get overall dashboard statistics"""
    
    # Member stats
    total_members = members_collection.count_documents({})
    active_members = members_collection.count_documents({"status": "active"})
    inactive_members = members_collection.count_documents({"status": "inactive"})
    expired_members = members_collection.count_documents({"status": "expired"})
    
    # Revenue stats
    all_subscriptions = list(member_subscriptions_collection.find({}))
    total_revenue = sum(sub["payment_amount"] for sub in all_subscriptions)
    total_subscriptions = len(all_subscriptions)
    active_subscriptions = member_subscriptions_collection.count_documents({"status": "active"})
    
    # Current month revenue
    now = datetime.now()
    month_start = datetime(now.year, now.month, 1)
    monthly_subscriptions = list(member_subscriptions_collection.find({
        "payment_date": {"$gte": month_start}
    }))
    monthly_revenue = sum(sub["payment_amount"] for sub in monthly_subscriptions)
    
    # Current year revenue
    year_start = datetime(now.year, 1, 1)
    yearly_subscriptions = list(member_subscriptions_collection.find({
        "payment_date": {"$gte": year_start}
    }))
    yearly_revenue = sum(sub["payment_amount"] for sub in yearly_subscriptions)
    
    # Attendance stats
    today = datetime.now().strftime("%Y-%m-%d")
    today_attendance = attendance_collection.count_documents({"date": today})
    currently_in_gym = attendance_collection.count_documents({
        "date": today,
        "check_out_time": None
    })
    
    # This week attendance
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    week_attendance = attendance_collection.count_documents({
        "date": {"$gte": week_ago}
    })
    
    return {
        "members": {
            "total": total_members,
            "active": active_members,
            "inactive": inactive_members,
            "expired": expired_members
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "monthly": round(monthly_revenue, 2),
            "yearly": round(yearly_revenue, 2),
            "total_subscriptions": total_subscriptions,
            "active_subscriptions": active_subscriptions
        },
        "attendance": {
            "today": today_attendance,
            "currently_in_gym": currently_in_gym,
            "this_week": week_attendance
        }
    }

# ============ REVENUE REPORTS ============

@router.get("/revenue/monthly")
async def get_monthly_revenue(year: int = Query(datetime.now().year), month: int = Query(datetime.now().month)):
    """Get revenue for a specific month"""
    
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    
    # Calculate date range
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # Get subscriptions in this month
    subscriptions = list(member_subscriptions_collection.find({
        "payment_date": {"$gte": start_date, "$lt": end_date}
    }))
    
    total_revenue = sum(sub["payment_amount"] for sub in subscriptions)
    total_subscriptions = len(subscriptions)
    
    # Group by payment mode
    payment_modes = defaultdict(float)
    for sub in subscriptions:
        payment_modes[sub["payment_mode"]] += sub["payment_amount"]
    
    return {
        "year": year,
        "month": month,
        "total_revenue": round(total_revenue, 2),
        "total_subscriptions": total_subscriptions,
        "average_per_subscription": round(total_revenue / total_subscriptions, 2) if total_subscriptions > 0 else 0,
        "payment_breakdown": dict(payment_modes)
    }

@router.get("/revenue/yearly")
async def get_yearly_revenue(year: int = Query(datetime.now().year)):
    """Get revenue breakdown by month for a year"""
    
    monthly_data = []
    
    for month in range(1, 13):
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        subscriptions = list(member_subscriptions_collection.find({
            "payment_date": {"$gte": start_date, "$lt": end_date}
        }))
        
        revenue = sum(sub["payment_amount"] for sub in subscriptions)
        
        monthly_data.append({
            "month": month,
            "month_name": start_date.strftime("%B"),
            "revenue": round(revenue, 2),
            "subscriptions": len(subscriptions)
        })
    
    total_yearly_revenue = sum(m["revenue"] for m in monthly_data)
    
    return {
        "year": year,
        "total_revenue": round(total_yearly_revenue, 2),
        "monthly_breakdown": monthly_data
    }

@router.get("/revenue/by-plan")
async def get_revenue_by_plan():
    """Get revenue breakdown by subscription plans"""
    
    plans = list(plans_collection.find({}))
    plan_revenue = []
    
    for plan in plans:
        plan_id = str(plan["_id"])
        subscriptions = list(member_subscriptions_collection.find({"plan_id": plan_id}))
        
        revenue = sum(sub["payment_amount"] for sub in subscriptions)
        
        plan_revenue.append({
            "plan_id": plan_id,
            "plan_name": plan["plan_name"],
            "total_subscriptions": len(subscriptions),
            "total_revenue": round(revenue, 2),
            "plan_price": plan["price"]
        })
    
    # Sort by revenue (highest first)
    plan_revenue.sort(key=lambda x: x["total_revenue"], reverse=True)
    
    return plan_revenue

# ============ ATTENDANCE REPORTS ============

@router.get("/attendance/summary")
async def get_attendance_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get attendance summary for a date range"""
    
    query = {}
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    else:
        # Default to last 30 days
        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        query["date"] = {"$gte": thirty_days_ago}
    
    attendance_records = list(attendance_collection.find(query))
    
    total_attendance = len(attendance_records)
    unique_members = len(set(record["member_id"] for record in attendance_records))
    
    # Group by date
    daily_attendance = defaultdict(int)
    for record in attendance_records:
        daily_attendance[record["date"]] += 1
    
    average_daily = sum(daily_attendance.values()) / len(daily_attendance) if daily_attendance else 0
    
    return {
        "total_attendance": total_attendance,
        "unique_members": unique_members,
        "average_daily_attendance": round(average_daily, 2),
        "daily_breakdown": dict(sorted(daily_attendance.items()))
    }

@router.get("/attendance/member/{member_id}")
async def get_member_attendance_stats(member_id: str):
    """Get attendance statistics for a specific member"""
    
    from app.utils import check_member_exists
    member = check_member_exists(member_id)
    
    # Total attendance
    total_attendance = attendance_collection.count_documents({"member_id": member_id})
    
    # Current month attendance
    now = datetime.now()
    month_start = datetime(now.year, now.month, 1).strftime("%Y-%m-%d")
    monthly_attendance = attendance_collection.count_documents({
        "member_id": member_id,
        "date": {"$gte": month_start}
    })
    
    # Last check-in
    last_attendance = attendance_collection.find_one(
        {"member_id": member_id},
        sort=[("check_in_time", -1)]
    )
    
    last_checkin = last_attendance["check_in_time"] if last_attendance else None
    
    # Get all attendance records for this member
    all_records = list(attendance_collection.find(
        {"member_id": member_id}
    ).sort("date", 1))
    
    # Calculate average visits per week
    if all_records:
        first_date = datetime.strptime(all_records[0]["date"], "%Y-%m-%d")
        last_date = datetime.strptime(all_records[-1]["date"], "%Y-%m-%d")
        days_difference = (last_date - first_date).days
        weeks = max(days_difference / 7, 1)
        avg_per_week = total_attendance / weeks
    else:
        avg_per_week = 0
    
    return {
        "member_id": member_id,
        "member_name": member["name"],
        "total_attendance": total_attendance,
        "monthly_attendance": monthly_attendance,
        "last_check_in": last_checkin,
        "average_per_week": round(avg_per_week, 2)
    }

# ============ MEMBER REPORTS ============

@router.get("/members/growth")
async def get_member_growth(year: int = Query(datetime.now().year)):
    """Get member growth by month for a year"""
    
    monthly_data = []
    
    for month in range(1, 13):
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        new_members = members_collection.count_documents({
            "join_date": {"$gte": start_date, "$lt": end_date}
        })
        
        monthly_data.append({
            "month": month,
            "month_name": start_date.strftime("%B"),
            "new_members": new_members
        })
    
    total_new_members = sum(m["new_members"] for m in monthly_data)
    
    return {
        "year": year,
        "total_new_members": total_new_members,
        "monthly_breakdown": monthly_data
    }

@router.get("/members/expiring-soon")
async def get_expiring_members(days: int = Query(7, ge=1, le=30)):
    """Get members whose subscriptions are expiring soon"""
    
    end_date_threshold = datetime.now() + timedelta(days=days)
    
    expiring_subs = list(member_subscriptions_collection.find({
        "status": "active",
        "end_date": {"$lte": end_date_threshold, "$gte": datetime.now()}
    }).sort("end_date", 1))
    
    result = []
    for sub in expiring_subs:
        member = members_collection.find_one({"_id": ObjectId(sub["member_id"])})
        plan = plans_collection.find_one({"_id": ObjectId(sub["plan_id"])})
        
        if member and plan:
            result.append({
                "member_id": str(member["_id"]),
                "member_name": member["name"],
                "member_email": member["email"],
                "member_phone": member["phone"],
                "plan_name": plan["plan_name"],
                "end_date": sub["end_date"],
                "days_remaining": (sub["end_date"] - datetime.now()).days
            })
    
    return {
        "total_expiring": len(result),
        "members": result
    }

# ============ PLAN POPULARITY ============

@router.get("/plans/popularity")
async def get_plan_popularity():
    """Get popularity statistics for subscription plans"""
    
    plans = list(plans_collection.find({}))
    plan_stats = []
    
    for plan in plans:
        plan_id = str(plan["_id"])
        
        total_subs = member_subscriptions_collection.count_documents({"plan_id": plan_id})
        active_subs = member_subscriptions_collection.count_documents({
            "plan_id": plan_id,
            "status": "active"
        })
        
        plan_stats.append({
            "plan_id": plan_id,
            "plan_name": plan["plan_name"],
            "duration_months": plan["duration_months"],
            "price": plan["price"],
            "total_subscriptions": total_subs,
            "active_subscriptions": active_subs
        })
    
    # Sort by total subscriptions
    plan_stats.sort(key=lambda x: x["total_subscriptions"], reverse=True)
    
    return plan_stats