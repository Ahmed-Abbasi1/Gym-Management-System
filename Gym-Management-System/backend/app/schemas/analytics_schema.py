from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class RevenueStats(BaseModel):
    total_revenue: float
    total_subscriptions: int
    monthly_revenue: float
    yearly_revenue: float

class MemberStats(BaseModel):
    total_members: int
    active_members: int
    inactive_members: int
    expired_members: int

class AttendanceStats(BaseModel):
    total_attendance: int
    unique_members: int
    average_daily_attendance: float
    
class MonthlyReport(BaseModel):
    month: str
    year: int
    new_members: int
    revenue: float
    total_attendance: int