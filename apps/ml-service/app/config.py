from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    models_dir: str = "models"
    cors_origin: str = "http://localhost:3000"


settings = Settings()
