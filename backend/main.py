from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db import engine, Base, get_session
from models import Account, Project
from pydantic import BaseModel
import secrets

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Timeline+ API is running 🚀"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/health")
async def health():
    return {"status": "ok"}

class ProjectIn(BaseModel):
    account_email: str
    title: str
    event_date: str | None = None  # YYYY-MM-DD
    source: str = "manual"

@app.post("/projects")
async def create_project(body: ProjectIn, db: AsyncSession = Depends(get_session)):
    # upsert account by email
    result = await db.execute(select(Account).where(Account.email == body.account_email))
    acct = result.scalar_one_or_none()
    if not acct:
        acct = Account(email=body.account_email, name=None)
        db.add(acct)
        await db.flush()

    proj = Project(
        account_id=acct.id,
        title=body.title,
        event_date=(None if not body.event_date else body.event_date),
        source=body.source,
    )
    db.add(proj)
    await db.commit()
    await db.refresh(proj)
    return {"project_id": str(proj.id)}

@app.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_session)):
    rows = (await db.execute(select(Project))).scalars().all()
    return [{"id": str(p.id), "title": p.title, "event_date": str(p.event_date), "status": p.status} for p in rows]