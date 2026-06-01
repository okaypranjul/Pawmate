"""Iteration 2 backend tests: chat, prefs, sound prefs, session counter."""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for ln in f:
            if ln.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = ln.split('=', 1)[1].strip().strip('"').rstrip('/')
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def device_id():
    return f"test-device-2-{uuid.uuid4().hex[:10]}"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    mongo_url = "mongodb://localhost:27017"
    db_name = "test_database"
    with open('/app/backend/.env') as f:
        for ln in f:
            if ln.startswith('MONGO_URL='):
                mongo_url = ln.split('=', 1)[1].strip().strip('"')
            elif ln.startswith('DB_NAME='):
                db_name = ln.split('=', 1)[1].strip().strip('"')
    client = MongoClient(mongo_url)
    yield client[db_name]
    client.close()


# ---------- Chat ----------
def test_chat_without_pet_returns_name_me(session):
    dev = f"test-device-2-nopet-{uuid.uuid4().hex[:8]}"
    r = session.post(f"{API}/chat", json={"device_id": dev, "message": "hi"})
    assert r.status_code == 200
    data = r.json()
    assert "reply" in data
    assert isinstance(data["reply"], str)
    # heuristic: should mention name in some form
    assert "name" in data["reply"].lower()


def test_chat_create_pet_first(session, device_id):
    r = session.post(f"{API}/pet", json={"device_id": device_id, "name": "Pixel2"})
    assert r.status_code == 200
    assert r.json()["name"] == "Pixel2"


def test_chat_joke_with_pet(session, device_id):
    r = session.post(
        f"{API}/chat",
        json={"device_id": device_id, "message": "tell me a joke"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "reply" in data
    assert isinstance(data["reply"], str)
    assert len(data["reply"].strip()) > 0


def test_chat_with_history(session, device_id):
    r = session.post(
        f"{API}/chat",
        json={
            "device_id": device_id,
            "message": "what did I just ask?",
            "history": [
                {"role": "user", "text": "tell me a joke"},
                {"role": "pet", "text": "Why did the cat sit on the keyboard?"},
            ],
        },
    )
    assert r.status_code == 200
    assert isinstance(r.json()["reply"], str)
    assert len(r.json()["reply"]) > 0


# ---------- Prefs ----------
def test_prefs_defaults_fresh_device(session):
    dev = f"test-device-2-fresh-{uuid.uuid4().hex[:8]}"
    r = session.get(f"{API}/prefs", params={"device_id": dev})
    assert r.status_code == 200
    data = r.json()
    assert data["master_volume"] == 0.7
    assert data["muted"] is False
    assert data["sounds"] == []
    assert data["today_sessions"] == 0
    # YYYY-MM-DD format
    assert len(data["today"]) == 10
    datetime.strptime(data["today"], "%Y-%m-%d")


def test_save_sound_prefs_and_retrieve(session, device_id):
    payload = {
        "device_id": device_id,
        "master_volume": 0.42,
        "muted": True,
        "sounds": [
            {"key": "rain", "enabled": True, "volume": 0.8},
            {"key": "ocean", "enabled": False, "volume": 0.3},
        ],
    }
    r = session.post(f"{API}/prefs/sounds", json=payload)
    assert r.status_code == 200
    assert r.json().get("ok") is True

    r2 = session.get(f"{API}/prefs", params={"device_id": device_id})
    assert r2.status_code == 200
    data = r2.json()
    assert data["master_volume"] == 0.42
    assert data["muted"] is True
    assert len(data["sounds"]) == 2
    by_key = {s["key"]: s for s in data["sounds"]}
    assert by_key["rain"]["enabled"] is True
    assert by_key["rain"]["volume"] == 0.8
    assert by_key["ocean"]["enabled"] is False


# ---------- Sessions ----------
def test_session_deep_increments_and_returns_message(session, device_id):
    # snapshot count before
    before = session.get(f"{API}/prefs", params={"device_id": device_id}).json()["today_sessions"]
    r = session.post(
        f"{API}/prefs/sessions",
        json={"device_id": device_id, "session_type": "deep", "duration_minutes": 25},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["today_sessions"] == before + 1
    assert data["message"] is not None
    assert isinstance(data["message"], str)
    assert len(data["message"]) > 0


def test_session_flow_increments(session, device_id):
    before = session.get(f"{API}/prefs", params={"device_id": device_id}).json()["today_sessions"]
    r = session.post(
        f"{API}/prefs/sessions",
        json={"device_id": device_id, "session_type": "flow", "duration_minutes": 50},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["today_sessions"] == before + 1
    assert data["message"] is not None
    assert isinstance(data["message"], str)


def test_session_break_does_not_increment_and_null_message(session, device_id):
    before = session.get(f"{API}/prefs", params={"device_id": device_id}).json()["today_sessions"]
    r = session.post(
        f"{API}/prefs/sessions",
        json={"device_id": device_id, "session_type": "break", "duration_minutes": 5},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["today_sessions"] == before  # no increment
    assert data["message"] is None


def test_prefs_today_sessions_persists(session, device_id):
    r = session.get(f"{API}/prefs", params={"device_id": device_id}).json()
    assert r["today_sessions"] >= 2  # one deep + one flow added above


# ---------- Regression of existing endpoints ----------
def test_regression_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["message"] == "purr"


def test_regression_notes(session, device_id):
    r = session.post(f"{API}/notes", json={"device_id": device_id, "text": "TEST_iter2_note"})
    assert r.status_code == 200
    nid = r.json()["id"]
    lst = session.get(f"{API}/notes", params={"device_id": device_id}).json()
    assert any(n["id"] == nid for n in lst)
    session.delete(f"{API}/notes/{nid}")


def test_regression_nudge(session, device_id):
    r = session.post(f"{API}/nudge", json={"device_id": device_id})
    assert r.status_code == 200
    assert r.json().get("message")


def test_regression_reminders_due_empty(session, device_id):
    r = session.get(f"{API}/reminders/due", params={"device_id": device_id})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Cleanup ----------
def test_zz_cleanup(mongo_db, device_id):
    mongo_db.pets.delete_many({"device_id": {"$regex": "^test-device-2-"}})
    mongo_db.notes.delete_many({"device_id": {"$regex": "^test-device-2-"}})
    mongo_db.reminders.delete_many({"device_id": {"$regex": "^test-device-2-"}})
    mongo_db.prefs.delete_many({"device_id": {"$regex": "^test-device-2-"}})
