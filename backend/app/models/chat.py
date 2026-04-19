from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"] | str
    content: str = ""


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    session_id: str = Field(default="session_1", alias="sessionId")
    base64_image: str | None = Field(default=None, alias="base64Image")
    image_key: str | None = Field(default=None, alias="imageKey")

    model_config = {"populate_by_name": True}


class ChatSessionUpdate(BaseModel):
    title: str | None = None
    archived: bool | None = None


class ChatSessionCreate(BaseModel):
    title: str | None = None


class SaveRecordRequest(BaseModel):
    intent: str
    data: dict[str, Any] = Field(default_factory=dict)
    entry_date: str | None = Field(default=None, alias="entryDate")

    model_config = {"populate_by_name": True}


class UpdateRecordRequest(BaseModel):
    data: dict[str, Any] | None = None
    entry_date: str | None = Field(default=None, alias="entryDate")

    model_config = {"populate_by_name": True}


class UploadImageRequest(BaseModel):
    base64_image: str = Field(alias="base64Image")

    model_config = {"populate_by_name": True}

