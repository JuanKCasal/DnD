from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    AIVEN_CA_CERT: str = "./certs/ca.pem"

    KAFKA_BOOTSTRAP_SERVERS: str
    KAFKA_SSL_CA_CERT: str = "./certs/ca.pem"
    KAFKA_SSL_CERT: str = "./certs/service.cert"
    KAFKA_SSL_KEY: str = "./certs/service.key"

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480

    # Stored as comma-separated string to avoid pydantic-settings JSON parsing
    # e.g. ALLOWED_ORIGINS="https://a.com,http://localhost:3000"
    ALLOWED_ORIGINS_STR: str = "https://juankcasal.github.io,http://localhost:3000"
    PORT: int = 8000

    def get_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS_STR.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
