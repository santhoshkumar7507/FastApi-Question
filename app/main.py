import json
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from . import models, database

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Camu Clone Real-Time API")

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.on_event("startup")
def startup_event():
    # Seed db with some users if empty
    db = database.SessionLocal()
    if not db.query(models.User).first():
        teacher = models.User(username="teacher1", full_name="Mr. Smith", is_teacher=True)
        student1 = models.User(username="student1", full_name="Alice Johnson", is_teacher=False)
        student2 = models.User(username="student2", full_name="Bob Williams", is_teacher=False)
        db.add_all([teacher, student1, student2])
        db.commit()
    db.close()

@app.get("/", response_class=HTMLResponse)
async def get_dashboard(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, db: Session = Depends(database.get_db)):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # parse json data
            parsed_data = json.loads(data)
            action = parsed_data.get("action")
            
            if action == "chat":
                # Save to db
                sender = db.query(models.User).filter(models.User.username == client_id).first()
                if sender:
                    msg = models.Message(content=parsed_data.get("content"), sender_id=sender.id)
                    db.add(msg)
                    db.commit()
                    # Broadcast
                    await manager.broadcast(json.dumps({
                        "type": "chat",
                        "sender": sender.full_name,
                        "content": parsed_data.get("content")
                    }))
            elif action == "announce":
                ann = models.Announcement(title=parsed_data.get("title"), content=parsed_data.get("content"))
                db.add(ann)
                db.commit()
                await manager.broadcast(json.dumps({
                    "type": "announcement",
                    "title": ann.title,
                    "content": ann.content
                }))
            elif action == "attendance":
                student_id = parsed_data.get("student_id")
                status = parsed_data.get("status")
                att = models.Attendance(student_id=student_id, status=status)
                db.add(att)
                db.commit()
                student = db.query(models.User).filter(models.User.id == student_id).first()
                await manager.broadcast(json.dumps({
                    "type": "attendance",
                    "student_name": student.full_name,
                    "status": status
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(json.dumps({"type": "system", "content": f"Client #{client_id} left the chat"}))

@app.get("/api/users")
def get_users(db: Session = Depends(database.get_db)):
    users = db.query(models.User).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name, "is_teacher": u.is_teacher} for u in users]

@app.get("/api/announcements")
def get_announcements(db: Session = Depends(database.get_db)):
    anns = db.query(models.Announcement).order_by(models.Announcement.timestamp.desc()).limit(10).all()
    return [{"id": a.id, "title": a.title, "content": a.content, "timestamp": str(a.timestamp)} for a in anns]

@app.get("/api/chat")
def get_chat_history(db: Session = Depends(database.get_db)):
    msgs = db.query(models.Message).order_by(models.Message.timestamp.desc()).limit(50).all()
    # Reverse to get chronological order
    msgs.reverse()
    return [{"sender": m.sender.full_name, "content": m.content, "timestamp": str(m.timestamp)} for m in msgs]
