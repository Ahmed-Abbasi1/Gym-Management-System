from app.routes import member_routes, subscription_routes, attendance_routes, analytics_routes
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import member_routes, subscription_routes, attendance_routes, analytics_routes, auth_routes

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Gym Management System API",
    version="1.0.0"
)

# CORS Middleware (for frontend connection later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_routes.router)
app.include_router(member_routes.router)
app.include_router(subscription_routes.router)
app.include_router(attendance_routes.router)
app.include_router(analytics_routes.router)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to Gym Management System API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}