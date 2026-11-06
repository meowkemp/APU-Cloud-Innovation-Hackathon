#Acts as a fake database for testing, with a fixed set of rooms and random availability.

import random
random.seed(42)  # same data every run, so tests are repeatable

def build_rooms():
    rooms = []
    for block in "ABC":
        for level in (4, 5, 6):
            for n in range(1, 11):
                rooms.append({
                    "room_id": f"{block}-{level}-{n}", "room_type": "classroom",
                    "block": block, "level": level,
                    "capacity": random.choice([20, 30, 40, 50]),
                    "facilities": random.sample(["projector", "whiteboard", "power_outlet"], k=random.randint(1, 3)),
                    "free_until": random.choice([None, "13:00", "15:00", "17:00"]),  # None = occupied
                })
        for n in range(1, 11):
            rooms.append({
                "room_id": f"Tech Lab {block}-6-{n}", "room_type": "tech_lab",
                "block": block, "level": 6,
                "capacity": random.choice([20, 25, 30]),
                "facilities": ["computers", "projector"],
                "free_until": random.choice([None, "15:00", "17:00"]),
            })
    return rooms

ROOMS = build_rooms()

def fake_find_free_rooms(q):
    out = []
    for r in ROOMS:
        if r["free_until"] is None: continue
        if q.start_time and q.start_time >= r["free_until"]: continue  # HH:MM compares correctly as text
        if q.block and r["block"] != q.block: continue
        if q.level and r["level"] != q.level: continue
        if q.room_type and r["room_type"] != q.room_type: continue
        if q.min_capacity and r["capacity"] < q.min_capacity: continue
        if any(f not in r["facilities"] for f in q.facilities): continue
        out.append(r)

    # Rank: closest capacity fit first, then free the longest
    want = q.min_capacity or 0
    out.sort(key=lambda r: (r["capacity"] - want, -int(r["free_until"].replace(":", ""))))
    return out