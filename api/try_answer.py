#Dev check
#Runs full flow to check that Gemini model is working and that the answer is formatted correctly.
#Dont test Gemini too much or you'll hit the quota limit. 

from datetime import datetime
from gemini_service import extract_query, write_answer
from mock_data import fake_find_free_rooms

questions = [
    "Any free room for 6 people in Block B at 2pm?",
    #"Tech lab in block A with computers",
    #"Free classroom on level 5 with a projector for 30 people",
    #"Can I book A-6-10 at 3pm?",
    #"What's the weather today?",
]

for q in questions:
    f = extract_query(q, datetime.now().isoformat())
    rooms = fake_find_free_rooms(f)[:5] if f.intent != "other" else []
    print("Q:", q)
    print("Filters:", f.model_dump())
    print("A:", write_answer(q, rooms))
    print()