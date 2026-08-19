from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./teriyaki.db"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    printer_host: str = "127.0.0.1"
    printer_port: int = 9100

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
