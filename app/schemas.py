from pydantic import BaseModel
from typing import Optional

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    is_teacher: bool

    class Config:
        orm_mode = True

class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    timestamp: str

class ChatMessageResponse(BaseModel):
    sender: str
    content: str
    timestamp: str
