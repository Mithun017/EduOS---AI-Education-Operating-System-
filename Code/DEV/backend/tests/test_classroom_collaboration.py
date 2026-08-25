import pytest
from app.ws.stream import classroom_manager

def test_create_room():
    room_info = classroom_manager.create_room("ROOM-TEST")
    assert "room_id" in room_info
    assert room_info["room_code"] == "ROOM-TEST"
    assert "secret_token" in room_info
    assert room_info["room_id"] in classroom_manager.rooms

def test_resolve_duplicate_display_names():
    room_info = classroom_manager.create_room("ROOM-NAMES")
    room_id = room_info["room_id"]
    
    # First student "Alex"
    name1 = classroom_manager.resolve_display_name(room_id, "Alex")
    assert name1 == "Alex"
    
    # Simulate connection
    room = classroom_manager.rooms[room_id]
    class MockConn:
        def __init__(self, name):
            self.display_name = name
            self.role = "student"
    
    room["connections"]["conn-1"] = MockConn("Alex")
    
    # Second student "Alex" -> should become "Alex (2)"
    name2 = classroom_manager.resolve_display_name(room_id, "Alex")
    assert name2 == "Alex (2)"
    
    room["connections"]["conn-2"] = MockConn("Alex (2)")
    
    # Third student "Alex" -> should become "Alex (3)"
    name3 = classroom_manager.resolve_display_name(room_id, "Alex")
    assert name3 == "Alex (3)"
