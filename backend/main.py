from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db import engine, Base, get_session
from models import Account, Project, Timeline
from pydantic import BaseModel
import datetime, secrets
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

class ProjectIn(BaseModel):
    account_email: str      # photographer's email
    title: str              # "Ava & Ben — 2026-06-20"
    event_date: str | None = None  # "2026-06-20"
    source: str = "manual"         # later: "honeybook"

class TimelineInput(BaseModel):
    project_id: str
    ceremony_time: str            # "16:30" (24h) or "4:30 PM"
    first_look: bool = True
    group_photo_count: int = 10
    travel_minutes_between_locations: int = 0

def parse_time_on_event(date: datetime.date, time_str: str) -> datetime.datetime:
    # Accepts "16:30" or "4:30 PM"
    try:
        t = datetime.datetime.strptime(time_str.strip(), "%H:%M").time()
    except ValueError:
        t = datetime.datetime.strptime(time_str.strip(), "%I:%M %p").time()
    return datetime.datetime.combine(date, t)

@app.post("/projects")
async def create_project(body: ProjectIn, db: AsyncSession = Depends(get_session)):
    # 1) find or create the account by email
    result = await db.execute(select(Account).where(Account.email == body.account_email))
    acct = result.scalar_one_or_none()
    if not acct:
        acct = Account(email=body.account_email, name=None)
        db.add(acct)
        await db.flush()  # get acct.id

    # 2) parse event_date string into date (or None)
    event_date = None
    if body.event_date:
        event_date = datetime.date.fromisoformat(body.event_date)

    # 3) create the project
    proj = Project(
        account_id=acct.id,
        title=body.title,
        event_date=event_date,
        source=body.source,
    )
    db.add(proj)
    await db.commit()
    await db.refresh(proj)

    return {"project_id": str(proj.id)}

@app.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_session)):
    rows = (await db.execute(select(Project))).scalars().all()
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "event_date": (p.event_date.isoformat() if p.event_date else None),
            "status": p.status,
        }
        for p in rows
    ]

@app.post("/timeline/generate")
async def generate_timeline(body: TimelineInput, db: AsyncSession = Depends(get_session)):
    # 1) load project
    pid = body.project_id
    result = await db.execute(select(Project).where(Project.id == pid))
    proj = result.scalar_one_or_none()
    if not proj or not proj.event_date:
        return {"error": "Project not found or event_date missing"}

    event_dt = parse_time_on_event(proj.event_date, body.ceremony_time)

    # 2) build a very simple schedule (you can tweak later)
    items = []

    # Example: 90 mins before ceremony for portraits / first look
    if body.first_look:
        items.append({
            "time": (event_dt - datetime.timedelta(minutes=90)).strftime("%I:%M %p"),
            "label": "First look & couple portraits"
        })
    items.append({
        "time": (event_dt - datetime.timedelta(minutes=60)).strftime("%I:%M %p"),
        "label": "Wedding party photos"
    })
    items.append({
        "time": event_dt.strftime("%I:%M %p"),
        "label": "Ceremony begins"
    })
    items.append({
        "time": (event_dt + datetime.timedelta(minutes=40)).strftime("%I:%M %p"),
        "label": f"Family formals ({body.group_photo_count} groups)"
    })
    items.append({
        "time": (event_dt + datetime.timedelta(minutes=60)).strftime("%I:%M %p"),
        "label": "Cocktail hour coverage"
    })

    # 3) upsert Timeline row
    # check if exists
    r2 = await db.execute(select(Timeline).where(Timeline.project_id == proj.id))
    tl = r2.scalar_one_or_none()

    if not tl:
        slug = secrets.token_urlsafe(8)
        tl = Timeline(
            project_id=proj.id,
            schedule={"items": items},
            public_slug=slug,
        )
        db.add(tl)
    else:
        tl.schedule = {"items": items}

    await db.commit()
    await db.refresh(tl)

    return {
        "project_id": str(proj.id),
        "slug": tl.public_slug,
        "items": items,
    }


@app.get("/t/{slug}")
async def get_public_timeline(slug: str, db: AsyncSession = Depends(get_session)):
    # 1) Load the timeline row by slug
    result = await db.execute(
        select(Timeline).where(Timeline.public_slug == slug)
    )
    tl = result.scalar_one_or_none()
    if not tl:
        raise HTTPException(status_code=404, detail="Timeline not found")

    # 2) Explicitly load the related project (NO lazy loading)
    proj_title = None
    proj_date = None

    if tl.project_id:
        res2 = await db.execute(
            select(Project).where(Project.id == tl.project_id)
        )
        proj = res2.scalar_one_or_none()
        if proj:
            proj_title = proj.title
            proj_date = proj.event_date.isoformat() if proj.event_date else None

    # 3) Return a clean, JSON-serializable payload
    return {
        "title": proj_title,
        "event_date": proj_date,
        "items": tl.schedule.get("items", []),
    }