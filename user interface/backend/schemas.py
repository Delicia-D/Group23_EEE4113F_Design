from pydantic import BaseModel
from datetime import datetime

class UploadVisit(BaseModel):
    weight: float
    timestamp: datetime
    rfid: str
class PenguinNoteCreate(BaseModel):
    note: str

class PenguinNoteOut(BaseModel):
    id: int
    penguin_id: int
    note: str
    created_at: datetime

    class Config:
        orm_mode = True
