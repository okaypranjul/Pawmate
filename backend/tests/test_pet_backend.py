"""Backend tests for PixelPet desktop pet app."""
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
    # fallback to read frontend .env
    with open('/app/frontend/.env') as f:
        for ln in f:
            if ln.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = ln.split('=', 1)[1].strip().strip('"').rstrip('/')
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def device_id():
    return f"TEST_dev_{uuid.uuid4().hex[:10]}"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    # use same MONGO_URL as backend
    mongo_url = "mongodb://localhost:27017"
    db_name = "test_database"
    try:
        with open('/app/backend/.env') as f:
            for ln in f:
                if ln.startswith('MONGO_URL='):
                    mongo_url = ln.split('=', 1)[1].strip().strip('"')
                elif ln.startswith('DB_NAME='):
                    db_name = ln.split('=', 1)[1].strip().strip('"')
    except Exception:
        pass
    client = MongoClient(mongo_url)
    yield client[db_name]
    client.close()


# ---------- Root ----------
def test_root_returns_purr(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message") == "purr"


# ---------- Pet CRUD ----------
def test_get_pet_first_time_null(session, device_id):
    r = session.get(f"{API}/pet", params={"device_id": device_id})
    assert r.status_code == 200
    data = r.json()
    assert data["pet"] is None
    assert data.get("welcome_back") is None


def test_create_pet(session, device_id):
    r = session.post(f"{API}/pet", json={"device_id": device_id, "name": "TestKitty"})
    assert r.status_code == 200
    pet = r.json()
    assert pet["name"] == "TestKitty"
    assert pet["device_id"] == device_id
    assert "id" in pet
    assert "created_at" in pet
    assert "last_interaction" in pet


def test_get_pet_after_create(session, device_id):
    r = session.get(f"{API}/pet", params={"device_id": device_id})
    assert r.status_code == 200
    data = r.json()
    assert data["pet"] is not None
    assert data["pet"]["name"] == "TestKitty"
    # fresh pet - no welcome_back
    assert data.get("welcome_back") is None


def test_pet_heartbeat(session, device_id):
    r = session.post(f"{API}/pet/heartbeat", params={"device_id": device_id})
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_pet_welcome_back_after_gap(session, device_id, mongo_db):
    # set last_interaction to 45 min ago
    past = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
    mongo_db.pets.update_one({"device_id": device_id}, {"$set": {"last_interaction": past}})
    r = session.get(f"{API}/pet", params={"device_id": device_id})
    assert r.status_code == 200
    data = r.json()
    assert data["pet"] is not None
    assert data.get("welcome_back") is not None
    assert isinstance(data["welcome_back"], str)
    assert len(data["welcome_back"]) > 0


# ---------- Notes ----------
def test_create_and_list_notes(session, device_id):
    r = session.post(f"{API}/notes", json={"device_id": device_id, "text": "TEST_buy milk"})
    assert r.status_code == 200
    note = r.json()
    assert note["text"] == "TEST_buy milk"
    assert "id" in note

    # list
    r2 = session.get(f"{API}/notes", params={"device_id": device_id})
    assert r2.status_code == 200
    notes = r2.json()
    assert any(n["id"] == note["id"] for n in notes)


def test_delete_note(session, device_id):
    r = session.post(f"{API}/notes", json={"device_id": device_id, "text": "TEST_to delete"})
    note_id = r.json()["id"]
    r2 = session.delete(f"{API}/notes/{note_id}")
    assert r2.status_code == 200
    r3 = session.get(f"{API}/notes", params={"device_id": device_id})
    assert not any(n["id"] == note_id for n in r3.json())


# ---------- Reminders ----------
@pytest.fixture(scope="module")
def short_reminder(session, device_id):
    """Reminder that will fire ~1 min in future."""
    local_iso = datetime.now(timezone.utc).astimezone().isoformat()
    r = session.post(
        f"{API}/reminders",
        json={"device_id": device_id, "text": "review PR in 1 minute", "local_iso": local_iso},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_create_reminder_in_1_min(short_reminder):
    rem = short_reminder
    assert "id" in rem
    assert "trigger_at" in rem
    # parse and confirm ~1 minute in future
    dt = datetime.fromisoformat(rem["trigger_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    diff_sec = (dt - now).total_seconds()
    # allow generous range: 30s to 180s
    assert 20 < diff_sec < 200, f"trigger_at diff was {diff_sec}s"
    # content should be cleaned
    assert "minute" not in rem["content"].lower()
    assert len(rem["content"]) > 0


def test_create_reminder_lunch_at_1pm(session, device_id):
    local_iso = datetime.now(timezone.utc).astimezone().isoformat()
    r = session.post(
        f"{API}/reminders",
        json={"device_id": device_id, "text": "lunch at 1pm", "local_iso": local_iso},
    )
    assert r.status_code == 200
    rem = r.json()
    # validate trigger_at is valid ISO
    dt = datetime.fromisoformat(rem["trigger_at"].replace("Z", "+00:00"))
    # convert to local tz
    local_now = datetime.fromisoformat(local_iso)
    local_dt = dt.astimezone(local_now.tzinfo)
    assert local_dt.hour == 13, f"expected hour 13 but got {local_dt.hour}"
    assert "lunch" in rem["content"].lower()


def test_list_reminders(session, device_id):
    r = session.get(f"{API}/reminders", params={"device_id": device_id})
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


def test_due_reminders_fires_after_wait(session, device_id, short_reminder):
    # wait ~75 sec for it to be due
    print("Waiting 75s for reminder to fire...")
    time.sleep(75)
    r = session.get(f"{API}/reminders/due", params={"device_id": device_id})
    assert r.status_code == 200
    due = r.json()
    assert isinstance(due, list)
    hit = next((d for d in due if d["id"] == short_reminder["id"]), None)
    assert hit is not None, f"Expected reminder {short_reminder['id']} in due list: {due}"
    assert hit["fired"] is True
    assert hit.get("message")
    assert isinstance(hit["message"], str)
    assert len(hit["message"]) > 0

    # subsequent call should not return same item
    r2 = session.get(f"{API}/reminders/due", params={"device_id": device_id})
    assert r2.status_code == 200
    assert not any(d["id"] == short_reminder["id"] for d in r2.json())


def test_delete_reminder(session, device_id):
    local_iso = datetime.now(timezone.utc).astimezone().isoformat()
    r = session.post(
        f"{API}/reminders",
        json={"device_id": device_id, "text": "TEST_delete me later", "local_iso": local_iso},
    )
    rid = r.json()["id"]
    r2 = session.delete(f"{API}/reminders/{rid}")
    assert r2.status_code == 200
    r3 = session.get(f"{API}/reminders", params={"device_id": device_id})
    assert not any(rem["id"] == rid for rem in r3.json())


# ---------- Nudge ----------
def test_nudge_returns_message(session, device_id):
    r = session.post(f"{API}/nudge", json={"device_id": device_id})
    assert r.status_code == 200
    data = r.json()
    assert data.get("message")
    assert isinstance(data["message"], str)
    assert len(data["message"]) > 0


def test_nudge_with_used_lines(session, device_id):
    used = ["just checking in!", "hi there friend"]
    r = session.post(f"{API}/nudge", json={"device_id": device_id, "used_lines": used})
    assert r.status_code == 200
    msg = r.json().get("message")
    assert msg
    assert isinstance(msg, str)


def test_nudge_no_pet_returns_null(session):
    fake_dev = f"TEST_no_pet_{uuid.uuid4().hex[:8]}"
    r = session.post(f"{API}/nudge", json={"device_id": fake_dev})
    assert r.status_code == 200
    assert r.json().get("message") is None


# ---------- Cleanup ----------
def test_zz_cleanup(mongo_db, device_id):
    mongo_db.pets.delete_many({"device_id": device_id})
    mongo_db.notes.delete_many({"device_id": device_id})
    mongo_db.reminders.delete_many({"device_id": device_id})
