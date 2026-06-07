# Camu Clone - Real-Time Campus Management System

An impressive, real-time student and campus management application built with **FastAPI** and **Vanilla JS/CSS**.

## Features
- **Real-Time Global Chat**: Instant messaging for students and teachers powered by WebSockets.
- **Live Announcements**: Teachers can push announcements that instantly appear on all student dashboards.
- **Live Attendance**: Teachers can mark student attendance with real-time updates.
- **Premium UI**: A stunning Glassmorphism design with responsive micro-animations and smooth transitions.
- **No Build Tools Required**: Pure HTML, JS, and CSS architecture to ensure simplicity and maximum performance without needing Node.js or bundlers.

## Tech Stack
- **Backend:** FastAPI, Python, SQLAlchemy, Uvicorn, WebSockets
- **Database:** SQLite
- **Frontend:** HTML, Vanilla JavaScript, Vanilla CSS

## Setup and Installation

### Prerequisites
- Python 3.8+ installed on your system.

### 1. Create a Virtual Environment
```bash
python -m venv venv
```

### 2. Activate the Environment
- Windows:
  ```bash
  .\venv\Scripts\activate
  ```
- Mac/Linux:
  ```bash
  source venv/bin/activate
  ```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
Start the Uvicorn server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## How to Use
1. Open a browser tab to `http://localhost:8000` and select the **Teacher** account.
2. Open a second browser tab (or incognito window) to the same URL and select a **Student** account.
3. Test out the real-time features by sending a chat message or broadcasting a new announcement from the teacher's dashboard.

## Database Note
The application uses SQLite (`camu_clone.db`). The database is automatically seeded with initial teacher and student accounts the first time you run the application.