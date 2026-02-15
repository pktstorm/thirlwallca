from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://thirlwall:thirlwall_dev@localhost:5432/thirlwall"

    aws_region: str = "us-east-1"
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_region: str = "us-east-1"

    s3_media_bucket: str = "thirlwall-media"
    s3_region: str = "us-east-1"

    api_cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

settings = Settings()
