from fastapi import FastAPI, File, UploadFile, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from schemas import UploadVisit
from database import SessionLocal, engine
from models import Base
import crud
import os
from datetime import datetime
from models import Penguin, Visit
from fastapi.responses import FileResponse
import csv
from io import StringIO
from fastapi.responses import StreamingResponse
from fastapi import HTTPException
from pydantic import BaseModel
from collections import defaultdict
from utils.r2_upload import generate_presigned_url
from schemas import PenguinNoteCreate, PenguinNoteOut
# Create DB tables
Base.metadata.create_all(bind=engine)


app = FastAPI()



# Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
@app.get("/")
def root():
    return {"message": "Penguin Monitoring API is running "}


# ------------------------------------
#  Upload API
# ------------------------------------
@app.post("/upload")
async def upload_visit(
    rfid: str = Form(...),
    weight: float = Form(...),
    timestamp: str = Form(...),
    image: UploadFile = File(...),  #
    db: Session = Depends(get_db)
):
    # Parse timestamp from string
    try:
      dt = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M")
    except ValueError:
      dt = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%S")


    # Get or create penguin
    penguin = crud.get_or_create_penguin(db, rfid)

    # Save visit
    visit = crud.create_visit(db, penguin.id, weight, dt, image)

    return {"message": "Upload successful", "visit_id": visit.id}


@app.get("/api/penguins")
def get_penguin_summaries(db: Session = Depends(get_db)):
    # Fetch all penguins
    penguins = db.query(Penguin).all()
    
    # Fetch all visits once
    visits = db.query(Visit).order_by(Visit.timestamp).all()

    # Group visits by penguin_id
    visit_map = defaultdict(list)
    for v in visits:
        visit_map[v.penguin_id].append(v)

    # Build summaries
    summaries = []
    for p in penguins:
        penguin_visits = visit_map.get(p.id, [])
        visit_count = len(penguin_visits)
        latest_visit = penguin_visits[-1] if penguin_visits else None

        summaries.append({
            "penguin_id": f"{p.id:03d}",
            "rfid": p.rfid,
            "latest_weight": latest_visit.weight if latest_visit else None,
            "last_seen": latest_visit.timestamp.strftime("%Y-%m-%d %H:%M") if latest_visit else None,
            "visit_count": visit_count,
            "last_image": generate_presigned_url(latest_visit.image_path) if latest_visit else None,
            "status": p.status,
            "visits": [
                {
                    "timestamp": v.timestamp.isoformat(),
                    "weight": v.weight,
                    "image_url": generate_presigned_url(v.image_path)
                }
                for v in penguin_visits
            ]
        })

    return summaries

@app.get("/penguin/{penguin_id}")
def get_penguin_data(penguin_id: int, db: Session = Depends(get_db)):
    penguin = db.query(Penguin).filter(Penguin.id == penguin_id).first()
    if not penguin:
        return {"error": "Penguin not found"}

    visits = db.query(Visit).filter(Visit.penguin_id == penguin.id).order_by(Visit.timestamp).all()

    return {
        "penguin_id": f"{penguin.id:03d}",
        "rfid": penguin.rfid,
        "visits": [
            {    "visit_number": i,
                "timestamp": v.timestamp.isoformat(),
                "weight": v.weight,
                "image_url": generate_presigned_url(v.image_path)
            }  for i, v in enumerate(visits, 1)
        ]
    }

@app.get("/penguin/{penguin_id}/download")
def download_penguin_visits(penguin_id: int, db: Session = Depends(get_db)):
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Visit #", "Date", "Time", "Weight"])

    visits = db.query(Visit).filter(Visit.penguin_id == penguin_id).order_by(Visit.timestamp).all()
    for i, v in enumerate(visits, 1):
        writer.writerow([
            i,
            v.timestamp.date().isoformat(),
            v.timestamp.time().isoformat(),
            v.weight,
            

        ])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=penguin_{penguin_id}_visits.csv"})


@app.get("/image/{filename}")
def get_image(filename: str):
    file_path = os.path.join("static/uploads", filename)
    return FileResponse(file_path)

@app.get("/download-all")
def download_all_visits(db: Session = Depends(get_db)):
    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(["Penguin ID", "RFID", "Timestamp", "Weight"])

    visits = db.query(Visit).join(Penguin).order_by(Penguin.id, Visit.timestamp).all()
    for v in visits:
        writer.writerow([
            f"{v.penguin.id:03d}",
            v.penguin.rfid,
            v.timestamp.isoformat(),
            v.weight,
            

        ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=all_penguin_visits.csv"}
    )
@app.delete("/penguin/{penguin_id}")
def delete_penguin(penguin_id: int, db: Session = Depends(get_db)):
    penguin = db.query(Penguin).filter(Penguin.id == penguin_id).first()
    if not penguin:
        return {"error": "Penguin not found"}

    # Delete all visits first
    db.query(Visit).filter(Visit.penguin_id == penguin_id).delete()

    # Then delete the penguin
    db.delete(penguin)
    db.commit()
    return {"message": f"Penguin {penguin_id} and all visits deleted"}
class StatusUpdate(BaseModel):
    status: str

@app.patch("/penguin/{penguin_id}/status")
def update_status(penguin_id: int, update: StatusUpdate, db: Session = Depends(get_db)):
    penguin = db.query(Penguin).filter(Penguin.id == penguin_id).first()
    if not penguin:
        raise HTTPException(status_code=404, detail="Penguin not found")
    
    penguin.status = update.status
    db.commit()
    db.refresh(penguin)
    return {"message": f"Status updated to {update.status}"}


@app.post("/penguin/{penguin_id}/notes", response_model=PenguinNoteOut)
def create_note(penguin_id: int, note: PenguinNoteCreate, db: Session = Depends(get_db)):
    return crud.add_penguin_note(db, penguin_id=penguin_id, note=note.note)



@app.post("/penguin/{penguin_id}/notes", response_model=PenguinNoteOut)
def create_note(penguin_id: int, note: PenguinNoteCreate, db: Session = Depends(get_db)):
    # First verify penguin exists
    penguin = db.query(Penguin).filter(Penguin.id == penguin_id).first()
    if not penguin:
        raise HTTPException(status_code=404, detail="Penguin not found")
    
    return crud.add_penguin_note(db, penguin_id=penguin_id, note=note.note)

@app.get("/penguin/{penguin_id}/notes", response_model=list[PenguinNoteOut])
def read_notes(penguin_id: int, db: Session = Depends(get_db)):
    try:
        
        if not db.query(Penguin).filter(Penguin.id == penguin_id).first():
            raise HTTPException(status_code=404, detail="Penguin not found")

        notes = crud.get_penguin_notes(db, penguin_id)
        return notes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
