import os
from sqlalchemy.orm import Session
from models import Penguin, Visit
from datetime import datetime
from fastapi import UploadFile
import shutil
from utils.r2_upload import upload_to_r2

UPLOAD_FOLDER = "static/uploads"

from models import PenguinNote

def get_or_create_penguin(db: Session, rfid: str):
    penguin = db.query(Penguin).filter(Penguin.rfid == rfid).first()
    if penguin:
        return penguin  

    new_penguin = Penguin(rfid=rfid)
    db.add(new_penguin)
    db.commit()
    db.refresh(new_penguin)
    return new_penguin

def create_visit(db: Session, penguin_id: int, weight: float, timestamp: datetime, image: UploadFile):
    filename = f"{penguin_id}_{int(timestamp.timestamp())}_{image.filename}"
    image.file.seek(0)  # ensure file is at start
    r2_path = upload_to_r2(image.file, filename, image.content_type)

    new_visit = Visit(
        penguin_id=penguin_id,
        weight=weight,
        timestamp=timestamp,
        image_path=r2_path  # store full path in DB
    )
    db.add(new_visit)
    db.commit()
    db.refresh(new_visit)
    return new_visit
def add_penguin_note(db: Session, penguin_id: int, note: str, user_id: str = "anonymous"):
    new_note = PenguinNote(
        penguin_id=penguin_id,
        note=note,
        user_id=user_id
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note
def get_penguin_notes(db: Session, penguin_id: int):
    return (
        db.query(PenguinNote)
        .filter(PenguinNote.penguin_id == penguin_id)
        .order_by(PenguinNote.created_at.desc())
        .all()
    )