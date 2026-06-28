import base64
import tempfile
import os
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

    # Cert contents as base64 (used in Railway where files don't exist)
    AIVEN_CA_CERT_B64: str = ""
    KAFKA_SSL_CERT_B64: str = ""
    KAFKA_SSL_KEY_B64: str = ""

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480

    ALLOWED_ORIGINS_STR: str = "https://juankcasal.github.io,http://localhost:3000"
    PORT: int = 8000

    def get_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS_STR.split(",") if o.strip()]

    def resolve_cert_path(self, file_path: str, b64_content: str) -> str:
        """Returns file path if it exists, otherwise writes b64 content to a temp file."""
        if os.path.exists(file_path):
            return file_path
        if b64_content:
            # Strip whitespace and any existing padding, then add exactly the right amount
            b64_clean = b64_content.strip().rstrip("=")
            remainder = len(b64_clean) % 4
            if remainder == 2:
                b64_clean += "=="
            elif remainder == 3:
                b64_clean += "="
            content = base64.b64decode(b64_clean)
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
            tmp.write(content)
            tmp.flush()
            tmp.close()
            return tmp.name
        raise FileNotFoundError(f"Cert not found: {file_path} and no base64 fallback set")

    def get_ca_cert_path(self) -> str:
        return self.resolve_cert_path(self.AIVEN_CA_CERT, self.AIVEN_CA_CERT_B64)

    def get_kafka_cert_path(self) -> str:
        return self.resolve_cert_path(self.KAFKA_SSL_CERT, self.KAFKA_SSL_CERT_B64)

    def get_kafka_key_path(self) -> str:
        return self.resolve_cert_path(self.KAFKA_SSL_KEY, self.KAFKA_SSL_KEY_B64)


@lru_cache
def get_settings() -> Settings:
    return Settings()
