from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")

client = MongoClient(MONGODB_URL)
database = client[DATABASE_NAME]

# Collections
members_collection = database["members"]
subscriptions_collection = database["subscriptions"]
attendance_collection = database["attendance"]
plans_collection = database["subscription_plans"]
member_subscriptions_collection = database["member_subscriptions"]
workout_plans_collection = database["workout_plans"]
users_collection = database["users"]

def get_database():
    return database