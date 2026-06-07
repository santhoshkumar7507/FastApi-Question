from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    is_teacher = Column(Boolean, default=False)

    messages = relationship("Message", back_populates="sender")
    attendances = relationship("Attendance", back_populates="student")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    sender_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    sender = relationship("User", back_populates="messages")

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    content = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String) # 'present', 'absent'
    date = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("User", back_populates="attendances")
