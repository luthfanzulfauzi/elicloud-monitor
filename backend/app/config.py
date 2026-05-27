from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ZSTACK_ENDPOINT: str = "http://zstack-mgmt:8080"
    ZSTACK_ACCESS_KEY_ID: str = ""
    ZSTACK_ACCESS_KEY_SECRET: str = ""
    ZSTACK_ACCOUNT: str = "admin"
    ZSTACK_PASSWORD_HASH: str = ""
    ZSTACK_POLL_INTERVAL_SECONDS: int = 300

    DATABASE_URL: str = "postgresql+asyncpg://elicloud:elicloud@postgres:5432/elicloudmonitor"

    APP_PORT: int = 8000
    APP_ENV: str = "development"
    SECRET_KEY: str = "changeme-in-production"

    ADMIN_DEFAULT_EMAIL: str = "admin@elitery.com"
    ADMIN_DEFAULT_PASSWORD: str = "admin123"

    CORS_ORIGINS: str = "*"

    SMARTCTL_DIR: str = "/app/smartctl"
    SMARTCTL_COLLECT_INTERVAL_SECONDS: int = 3600
    SMARTCTL_KNOWN_HOSTS: str = ""


settings = Settings()
