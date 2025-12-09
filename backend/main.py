from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from db import engine, Base, get_session
from models import Account, Project, Timeline
from pydantic import BaseModel
import datetime, secrets
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json
from datetime import date

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
    ceremony_time: str            # e.g. "4:30 PM" or "16:30"
    first_look: bool = True
    group_photo_count: int = 10
    travel_minutes_between_locations: int = 0

class TimelineItemUpdate(BaseModel):
    time: str
    label: str

class TimelineUpdate(BaseModel):
    items: List[TimelineItemUpdate]

def parse_time_on_event(date: datetime.date, time_str: str) -> datetime.datetime:
    """Parse '4:30 PM' or '16:30' into a datetime on the given date."""
    ts = time_str.strip()
    for fmt in ("%I:%M %p", "%I %p", "%H:%M"):
        try:
            t = datetime.datetime.strptime(ts, fmt).time()
            return datetime.datetime.combine(date, t)
        except ValueError:
            continue
    # fallback: noon if parsing fails
    return datetime.datetime.combine(date, datetime.time(12, 0))

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
    # LEFT JOIN projects with timelines, so we can see if a project already has a timeline
    result = await db.execute(
        select(Project, Timeline.public_slug)
        .select_from(Project)
        .join(Timeline, Timeline.project_id == Project.id, isouter=True)
    )
    rows = result.all()

    return [
        {
            "id": str(p.id),
            "title": p.title,
            "event_date": p.event_date.isoformat() if p.event_date else None,
            "status": p.status,
            "timeline_slug": slug,  # may be None if no timeline yet
        }
        for p, slug in rows
    ]

@app.post("/timeline/generate")
async def generate_timeline(body: TimelineInput, db: AsyncSession = Depends(get_session)):
    # 1) Load project
    result = await db.execute(select(Project).where(Project.id == body.project_id))
    proj = result.scalar_one_or_none()
    if not proj or not proj.event_date:
        return {"error": "Project not found or event_date missing"}

    event_date: datetime.date = proj.event_date
    ceremony_start = parse_time_on_event(event_date, body.ceremony_time)

    # Standard durations (you can tweak these later)
    CEREMONY_MIN = 30
    FIRST_LOOK_MIN = 10
    COUPLE_PORTRAITS_MIN = 25
    BRIDAL_PARTY_MIN = 20
    FAMILY_PER_GROUP_MIN = 2
    FAMILY_MIN = max(20, body.group_photo_count * FAMILY_PER_GROUP_MIN)
    GETTING_READY_BUFFER_MIN = 60
    PHOTO_ARRIVAL_BUFFER_MIN = 60
    TRAVEL_MIN = body.travel_minutes_between_locations

    items: list[dict] = []

    # 2) Build schedule depending on first look
    if body.first_look:
        # AFTER ceremony
        ceremony_end = ceremony_start + datetime.timedelta(minutes=CEREMONY_MIN)
        family_start = ceremony_end + datetime.timedelta(minutes=5)
        cocktail_start = family_start + datetime.timedelta(minutes=FAMILY_MIN)

        items.append({"time": ceremony_start, "label": "Ceremony begins"})
        items.append({"time": ceremony_end, "label": "Ceremony ends"})
        items.append({
            "time": family_start,
            "label": f"Family formals ({body.group_photo_count} groups)"
        })
        items.append({"time": cocktail_start, "label": "Cocktail hour & candid coverage"})

        # BEFORE ceremony – build backwards
        bridal_party_start = ceremony_start - datetime.timedelta(minutes=BRIDAL_PARTY_MIN + 10)
        couple_start = bridal_party_start - datetime.timedelta(minutes=COUPLE_PORTRAITS_MIN)
        first_look_start = couple_start - datetime.timedelta(minutes=FIRST_LOOK_MIN)

        # Optional travel before ceremony
        if TRAVEL_MIN > 0:
            travel_to_ceremony = first_look_start - datetime.timedelta(minutes=TRAVEL_MIN)
            items.append({
                "time": travel_to_ceremony,
                "label": f"Travel to ceremony location ({TRAVEL_MIN} min)"
            })
            getting_ready_done = travel_to_ceremony - datetime.timedelta(minutes=GETTING_READY_BUFFER_MIN)
        else:
            getting_ready_done = first_look_start - datetime.timedelta(minutes=GETTING_READY_BUFFER_MIN)

        photographer_arrive = getting_ready_done - datetime.timedelta(minutes=PHOTO_ARRIVAL_BUFFER_MIN)

        items.append({"time": first_look_start, "label": "First look & reactions"})
        items.append({"time": couple_start, "label": "Couple portraits"})
        items.append({"time": bridal_party_start, "label": "Wedding party photos"})
        items.append({"time": getting_ready_done, "label": "Hair & makeup finished / final touches"})
        items.append({"time": photographer_arrive, "label": "Photographer arrives & detail photos"})

    else:
        # NO first look – most portraits after ceremony

        ceremony_end = ceremony_start + datetime.timedelta(minutes=CEREMONY_MIN)
        buffer_after = ceremony_end + datetime.timedelta(minutes=10)
        family_start = buffer_after
        bridal_party_start = family_start + datetime.timedelta(minutes=FAMILY_MIN)
        couple_start = bridal_party_start + datetime.timedelta(minutes=BRIDAL_PARTY_MIN)

        items.append({"time": ceremony_start, "label": "Ceremony begins"})
        items.append({"time": ceremony_end, "label": "Ceremony ends"})
        items.append({
            "time": family_start,
            "label": f"Family formals ({body.group_photo_count} groups)"
        })
        items.append({"time": bridal_party_start, "label": "Wedding party photos"})
        items.append({"time": couple_start, "label": "Couple portraits (golden hour if possible)"})

        # Before ceremony: getting ready, details, travel
        if TRAVEL_MIN > 0:
            travel_to_ceremony = ceremony_start - datetime.timedelta(minutes=TRAVEL_MIN + 15)
            items.append({
                "time": travel_to_ceremony,
                "label": f"Travel to ceremony location ({TRAVEL_MIN} min + buffer)"
            })
            getting_ready_done = travel_to_ceremony - datetime.timedelta(minutes=GETTING_READY_BUFFER_MIN)
        else:
            getting_ready_done = ceremony_start - datetime.timedelta(minutes=GETTING_READY_BUFFER_MIN + 15)

        photographer_arrive = getting_ready_done - datetime.timedelta(minutes=PHOTO_ARRIVAL_BUFFER_MIN)

        items.append({"time": getting_ready_done, "label": "Hair & makeup finished / final touches"})
        items.append({"time": photographer_arrive, "label": "Photographer arrives & detail photos"})

    # 3) Sort items by time ascending and format nicely
    items_sorted = sorted(items, key=lambda x: x["time"])

    display_items = [
        {
            "time": dt.time().strftime("%I:%M %p").lstrip("0"),
            "label": it["label"],
        }
        for it in items_sorted
        for dt in [it["time"]]
    ]

    # 4) Upsert Timeline row & store inputs and items
    result = await db.execute(select(Timeline).where(Timeline.project_id == proj.id))
    tl = result.scalar_one_or_none()

    payload = {
        "inputs": {
            "ceremony_time": body.ceremony_time,
            "first_look": body.first_look,
            "group_photo_count": body.group_photo_count,
            "travel_minutes_between_locations": body.travel_minutes_between_locations,
        },
        "items": display_items,
    }

    if not tl:
        slug = secrets.token_urlsafe(8)
        tl = Timeline(
            project_id=proj.id,
            schedule=payload,
            public_slug=slug,
        )
        db.add(tl)
    else:
        tl.schedule = payload

    await db.commit()
    await db.refresh(tl)

    return {
        "project_id": str(proj.id),
        "slug": tl.public_slug,
        "items": display_items,
    }

@app.get("/t/{slug}")
async def get_public_timeline(
    slug: str,
    db: AsyncSession = Depends(get_session),
):
    # Load timeline + project title if available
    result = await db.execute(
        select(Timeline)
        .options(selectinload(Timeline.project))  # if you have relationship
        .where(Timeline.public_slug == slug)
    )
    tl = result.scalar_one_or_none()
    if not tl:
        raise HTTPException(status_code=404, detail="Timeline not found")

    # Normalize schedule JSON
    raw_schedule = tl.schedule
    if raw_schedule is None:
        schedule_data = {}
    elif isinstance(raw_schedule, str):
        try:
            schedule_data = json.loads(raw_schedule)
        except json.JSONDecodeError:
            schedule_data = {}
    else:
        schedule_data = raw_schedule

    items = schedule_data.get("items") or []

    # Title / event_date – adjust to your model
    title = None
    event_date = None

    # If you have a Project relationship with title & event_date:
    if getattr(tl, "project", None) is not None:
        title = tl.project.title
        event_date = (
            tl.project.event_date.isoformat()
            if getattr(tl.project, "event_date", None)
            else None
        )

    # Fallbacks if needed
    if not title and hasattr(tl, "title"):
        title = tl.title

    return {
        "title": title,
        "event_date": event_date,
        "items": items,
    }

@app.patch("/timeline/{slug}")
async def update_timeline(
    slug: str,
    body: dict,
    db: AsyncSession = Depends(get_session),
):
    # --- 1) Read incoming fields ---
    raw_items = body.get("items") or []
    title = body.get("title")          # may be None
    event_date_str = body.get("event_date")  # "2026-08-29" or None / ""

    if not isinstance(raw_items, list):
        raise HTTPException(status_code=400, detail="items must be a list")

    # Clean up items (force {time, label} shape)
    cleaned_items = []
    for it in raw_items:
        if not isinstance(it, dict):
            continue

        item_id = it.get("id")
        time = str(it.get("time", "")).strip()
        label = str(it.get("label", "")).strip()

        if not item_id or not label:
            continue

        cleaned_items.append({
            "id": item_id,
            "time": time,
            "label": label,
        })

    # --- 2) Load existing timeline + its project ---
    result = await db.execute(
        select(Timeline)
        .where(Timeline.public_slug == slug)
        .options(selectinload(Timeline.project))
    )
    tl = result.scalar_one_or_none()
    if not tl:
        raise HTTPException(status_code=404, detail="Timeline not found")

    # --- 3) Load existing schedule as dict ---
    raw_schedule = tl.schedule
    if raw_schedule is None:
        schedule_data = {}
    elif isinstance(raw_schedule, str):
        try:
            schedule_data = json.loads(raw_schedule)
        except json.JSONDecodeError:
            schedule_data = {}
    else:
        schedule_data = raw_schedule

    # Replace items
    schedule_data["items"] = cleaned_items

    # --- 4) Update project title / event_date if present ---
    if getattr(tl, "project", None):
        if title is not None:
            tl.project.title = title

        # event_date_str could be "", None, or "YYYY-MM-DD"
        if event_date_str:
            try:
                tl.project.event_date = date.fromisoformat(event_date_str)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid event_date format. Expected YYYY-MM-DD.",
                )
        else:
            # If you want to allow clearing the date:
            tl.project.event_date = None

    # 🔐 Always store schedule as JSON text so it’s consistent
    tl.schedule = json.dumps(schedule_data)

    await db.commit()
    await db.refresh(tl)

    # --- 5) Build response payload ---
    # decode schedule again to be safe
    schedule_out = schedule_data.get("items", [])

    return {
        "status": "ok",
        "title": tl.project.title if tl.project else None,
        "event_date": tl.project.event_date.isoformat() if tl.project and tl.project.event_date else None,
        "items": schedule_data["items"],
}