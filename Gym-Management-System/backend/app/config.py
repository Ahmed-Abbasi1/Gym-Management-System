from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    app_name: str = "Gym Management System"
    mongodb_url: str
    database_name: str
    debug: bool = True
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: str = "1440"

    class Config:
        env_file = ".env"

settings = Settings()