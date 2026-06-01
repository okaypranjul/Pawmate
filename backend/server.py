from fastapi import FastAPI, APIRouter, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
LLM_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# --------------------- Models ---------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Pet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    name: str
    created_at: str = Field(default_factory=now_iso)
    last_interaction: str = Field(default_factory=now_iso)


class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    text: str
    created_at: str = Field(default_factory=now_iso)


class Reminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    content: str
    raw_input: str
    trigger_at: str
    fired: bool = False
    created_at: str = Field(default_factory=now_iso)


class CreatePet(BaseModel):
    device_id: str
    name: str


class CreateNote(BaseModel):
    device_id: str
    text: str


class CreateReminder(BaseModel):
    device_id: str
    text: str
    local_iso: Optional[str] = None  # current local time of the user (ISO with tz)


class NudgeRequest(BaseModel):
    device_id: str
    used_lines: Optional[List[str]] = None  # avoid repeats this session


class ChatRequest(BaseModel):
    device_id: str
    message: str
    history: Optional[List[dict]] = None  # [{role:'user'|'pet', text:'...'}]


class SoundPref(BaseModel):
    key: str
    enabled: bool = False
    volume: float = 0.5  # 0..1


class SoundPrefs(BaseModel):
    device_id: str
    master_volume: float = 0.7
    muted: bool = False
    sounds: List[SoundPref] = Field(default_factory=list)


class FocusSessionEvent(BaseModel):
    device_id: str
    session_type: str  # 'deep' | 'flow' | 'break'
    duration_minutes: int


# --------------------- LLM helpers ---------------------
def _make_chat(session_id: str, system_message: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(*LLM_MODEL)


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        # remove the first fence and language tag
        text = text.split("```", 2)
        # text is now ['', 'json\n{...}\n', ''] or similar
        if len(text) >= 2:
            inner = text[1]
            if inner.startswith("json"):
                inner = inner[4:]
            return inner.strip()
    return text


async def parse_reminder_with_llm(text: str, local_iso: str) -> dict:
    system = (
        "You parse natural-language reminders into strict JSON. "
        f"The user's current local time is: {local_iso}. "
        "Return ONLY a JSON object with exactly these keys:\n"
        '- "content": short human-readable subject of the reminder (without time words).\n'
        '- "trigger_at": ISO 8601 datetime WITH timezone offset for when the reminder should fire. '
        "Interpret times relative to the user's local time above. If the time mentioned has already passed today, "
        "schedule it for tomorrow.\n"
        '- "has_time": boolean, true if user specified a time, false otherwise.\n\n'
        "If no time is specified, set trigger_at to 1 hour from the user's local time and has_time=false.\n"
        "Examples:\n"
        '"lunch at 1pm" -> {"content":"Lunch","trigger_at":"<today 13:00 local>","has_time":true}\n'
        '"review PR in 2 hours" -> {"content":"Review PR","trigger_at":"<now+2h local>","has_time":true}\n'
        '"call mom" -> {"content":"Call mom","trigger_at":"<now+1h local>","has_time":false}\n\n'
        "Output JSON only. No markdown. No commentary."
    )
    chat = _make_chat(f"parse-{uuid.uuid4()}", system)
    response = await chat.send_message(UserMessage(text=text))
    cleaned = _strip_code_fences(response)
    return json.loads(cleaned)


async def generate_message(pet_name: str, kind: str, context: str, avoid: Optional[List[str]] = None) -> str:
    avoid_block = ""
    if avoid:
        joined = " | ".join(avoid[-8:])
        avoid_block = f"\nAvoid repeating any of these recent lines: {joined}"

    if kind == "reminder":
        system = (
            f"You are {pet_name}, a warm, playful, fourth-wall-aware pixel-art cat companion "
            "who lives at the top-right corner of the user's screen. "
            "Generate ONE short reminder pop-up line in your character — max 16 words. "
            "Be cozy and gentle. Mention the task. Never use markdown. "
            "You may include 🐾 at most once. Do not wrap in quotes." + avoid_block
        )
        user_msg = f"The user has a reminder due now: {context}. Nudge them sweetly."
    elif kind == "check_in":
        system = (
            f"You are {pet_name}, a warm, playful, fourth-wall-aware pixel-art cat companion "
            "living in the top-right corner of the screen. Generate ONE brief in-character nudge or "
            "check-in — max 14 words. Vary tone: sometimes curious, sometimes encouraging, sometimes a tiny "
            "stretch/yawn, sometimes a meta wink ('peeking down from up here'). Never spammy. "
            "No markdown. No quotes. Optional single 🐾." + avoid_block
        )
        user_msg = f"Time of day right now: {context}. Send a little drive-by check-in."
    elif kind == "focus_complete":
        system = (
            f"You are {pet_name}, a warm, playful, fourth-wall-aware pixel-art cat companion. "
            "Generate ONE short congratulatory line for finishing a focus session — max 18 words. "
            "Mention the session type briefly. Be celebratory but cozy, not over the top. "
            "No markdown. No quotes. Optional single 🐾." + avoid_block
        )
        user_msg = f"User just finished a {context} focus session. Cheer them on."
    else:  # welcome_back
        system = (
            f"You are {pet_name}, a warm, playful pixel-art cat companion. "
            "Generate ONE short welcome-back greeting — max 28 words. "
            "Mention briefly any recap context you're given. In-character. No markdown. No quotes."
        )
        user_msg = f"The user just returned. {context}"

    chat = _make_chat(f"msg-{uuid.uuid4()}", system)
    response = await chat.send_message(UserMessage(text=user_msg))
    return response.strip().strip('"').strip("'")


# --------------------- Endpoints ---------------------
@api_router.get("/")
async def root():
    return {"message": "purr"}


@api_router.get("/pet")
async def get_pet(device_id: str = Query(...)):
    pet = await db.pets.find_one({"device_id": device_id}, {"_id": 0})
    if not pet:
        return {"pet": None, "welcome_back": None}

    welcome_back = None
    try:
        last = datetime.fromisoformat(pet["last_interaction"])
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        gap_min = (now - last).total_seconds() / 60.0
        if gap_min >= 30:
            active_notes = await db.notes.count_documents({"device_id": device_id})
            pending = await db.reminders.count_documents({"device_id": device_id, "fired": False})
            ctx = f"Away for about {int(gap_min)} minutes. Notes kept safe: {active_notes}. Reminders pending: {pending}."
            try:
                welcome_back = await generate_message(pet["name"], "welcome_back", ctx)
            except Exception as e:
                logger.warning(f"welcome_back llm failed: {e}")
                welcome_back = f"You're back! I kept your {active_notes} note(s) and {pending} reminder(s) safe 🐾"
    except Exception as e:
        logger.warning(f"welcome_back check failed: {e}")

    return {"pet": pet, "welcome_back": welcome_back}


@api_router.post("/pet")
async def create_or_rename_pet(input: CreatePet):
    name = input.name.strip()[:30] or "Pixel"
    existing = await db.pets.find_one({"device_id": input.device_id})
    if existing:
        await db.pets.update_one(
            {"device_id": input.device_id},
            {"$set": {"name": name, "last_interaction": now_iso()}}
        )
        pet = await db.pets.find_one({"device_id": input.device_id}, {"_id": 0})
        return pet
    pet = Pet(device_id=input.device_id, name=name)
    await db.pets.insert_one(pet.model_dump())
    return pet.model_dump()


@api_router.post("/pet/heartbeat")
async def heartbeat(device_id: str = Query(...)):
    await db.pets.update_one(
        {"device_id": device_id},
        {"$set": {"last_interaction": now_iso()}}
    )
    return {"ok": True}


@api_router.get("/notes")
async def list_notes(device_id: str = Query(...)):
    notes = await db.notes.find({"device_id": device_id}, {"_id": 0}).to_list(500)
    notes.sort(key=lambda n: n["created_at"], reverse=True)
    return notes


@api_router.post("/notes")
async def create_note(input: CreateNote):
    text = input.text.strip()
    if not text:
        return {"error": "empty"}
    note = Note(device_id=input.device_id, text=text[:500])
    await db.notes.insert_one(note.model_dump())
    return note.model_dump()


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    await db.notes.delete_one({"id": note_id})
    return {"ok": True}


@api_router.get("/reminders")
async def list_reminders(device_id: str = Query(...)):
    reminders = await db.reminders.find({"device_id": device_id}, {"_id": 0}).to_list(500)
    reminders.sort(key=lambda r: r["trigger_at"])
    return reminders


@api_router.post("/reminders")
async def create_reminder(input: CreateReminder):
    text = input.text.strip()
    if not text:
        return {"error": "empty"}

    local_iso = input.local_iso or now_iso()
    content = text
    trigger_at: Optional[str] = None

    try:
        parsed = await parse_reminder_with_llm(text, local_iso)
        content = (parsed.get("content") or text).strip()[:120]
        trigger_at = parsed.get("trigger_at")
        # validate
        dt = datetime.fromisoformat(trigger_at.replace("Z", "+00:00"))
        # normalize to UTC ISO
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        trigger_at = dt.astimezone(timezone.utc).isoformat()
    except Exception as e:
        logger.warning(f"reminder parse failed: {e}; using +1h fallback")
        trigger_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    reminder = Reminder(
        device_id=input.device_id,
        content=content,
        raw_input=text[:500],
        trigger_at=trigger_at,
    )
    await db.reminders.insert_one(reminder.model_dump())
    return reminder.model_dump()


@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str):
    await db.reminders.delete_one({"id": reminder_id})
    return {"ok": True}


@api_router.get("/reminders/due")
async def due_reminders(device_id: str = Query(...)):
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.reminders.find(
        {"device_id": device_id, "fired": False, "trigger_at": {"$lte": now}},
        {"_id": 0},
    )
    due = await cursor.to_list(20)
    if not due:
        return []

    pet = await db.pets.find_one({"device_id": device_id}, {"_id": 0})
    pet_name = pet["name"] if pet else "Pixel"

    results = []
    for r in due:
        try:
            msg = await generate_message(pet_name, "reminder", r["content"])
        except Exception as e:
            logger.warning(f"reminder msg llm failed: {e}")
            msg = f"Hey! Reminder: {r['content']} 🐾"
        await db.reminders.update_one({"id": r["id"]}, {"$set": {"fired": True}})
        results.append({**r, "message": msg, "fired": True})
    return results


@api_router.post("/nudge")
async def nudge(input: NudgeRequest):
    pet = await db.pets.find_one({"device_id": input.device_id}, {"_id": 0})
    if not pet:
        return {"message": None}
    hour = datetime.now(timezone.utc).hour
    if 5 <= hour < 12:
        tod = "morning"
    elif 12 <= hour < 18:
        tod = "afternoon"
    elif 18 <= hour < 22:
        tod = "evening"
    else:
        tod = "late night"
    try:
        msg = await generate_message(pet["name"], "check_in", tod, avoid=input.used_lines or [])
    except Exception as e:
        logger.warning(f"nudge llm failed: {e}")
        msg = "Just popping by to say hi 🐾"
    return {"message": msg}


@api_router.post("/chat")
async def chat(input: ChatRequest):
    pet = await db.pets.find_one({"device_id": input.device_id}, {"_id": 0})
    if not pet:
        return {"reply": "name me first so I know who's chatting 🐾"}

    history_text = ""
    for turn in (input.history or [])[-6:]:
        role = "User" if turn.get("role") == "user" else pet["name"]
        history_text += f"{role}: {turn.get('text', '')}\n"

    system = (
        f"You are {pet['name']}, a warm, playful, fourth-wall-aware pixel-art cat "
        "who lives in the top-right corner of the user's browser. You can reference being a tiny pixel cat. "
        "Keep replies short and cozy — usually 1–2 sentences, max 40 words. "
        "Be in-character: curious, encouraging, gently witty, never lecture. "
        "Match the user's vibe. No markdown. No quotes around your reply. "
        "Optional single 🐾 occasionally."
    )
    prompt = f"{history_text}User: {input.message}\n{pet['name']}:"

    try:
        chat_session = _make_chat(f"chat-{input.device_id}-{uuid.uuid4()}", system)
        reply = await chat_session.send_message(UserMessage(text=prompt))
        reply = reply.strip().strip('"').strip("'")
    except Exception as e:
        logger.warning(f"chat llm failed: {e}")
        reply = "purr — say that again? my whiskers got tangled."
    return {"reply": reply}


@api_router.get("/prefs")
async def get_prefs(device_id: str = Query(...)):
    doc = await db.prefs.find_one({"device_id": device_id}, {"_id": 0})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not doc:
        return {
            "device_id": device_id,
            "master_volume": 0.7,
            "muted": False,
            "sounds": [],
            "today_sessions": 0,
            "today": today,
        }
    sessions = doc.get("sessions", {})
    today_count = sessions.get(today, 0)
    return {
        "device_id": device_id,
        "master_volume": doc.get("master_volume", 0.7),
        "muted": doc.get("muted", False),
        "sounds": doc.get("sounds", []),
        "today_sessions": today_count,
        "today": today,
    }


@api_router.post("/prefs/sounds")
async def save_sound_prefs(input: SoundPrefs):
    await db.prefs.update_one(
        {"device_id": input.device_id},
        {
            "$set": {
                "device_id": input.device_id,
                "master_volume": input.master_volume,
                "muted": input.muted,
                "sounds": [s.model_dump() for s in input.sounds],
                "updated_at": now_iso(),
            }
        },
        upsert=True,
    )
    return {"ok": True}


@api_router.post("/prefs/sessions")
async def record_session(input: FocusSessionEvent):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # only count actual "work" sessions (deep, flow) — breaks excluded from the daily counter
    inc = 1 if input.session_type in ("deep", "flow") else 0
    update = {"$set": {"device_id": input.device_id, "updated_at": now_iso()}}
    if inc:
        update["$inc"] = {f"sessions.{today}": 1}
    await db.prefs.update_one({"device_id": input.device_id}, update, upsert=True)

    doc = await db.prefs.find_one({"device_id": input.device_id}, {"_id": 0})
    sessions = (doc or {}).get("sessions", {})
    today_count = sessions.get(today, 0)

    # generate a congratulatory message for work sessions
    message = None
    if inc:
        pet = await db.pets.find_one({"device_id": input.device_id}, {"_id": 0})
        if pet:
            label = "deep work" if input.session_type == "deep" else "flow state"
            try:
                message = await generate_message(pet["name"], "focus_complete", label)
            except Exception as e:
                logger.warning(f"focus complete llm failed: {e}")
                message = f"Nice {label} session! 🐾"
    return {"today_sessions": today_count, "message": message}


# --------------------- App wiring ---------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
