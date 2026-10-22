import json, sys, os
root = sys.argv[1]
track = json.load(open(os.path.join(root, "track.json")))
cast = {c["id"] for c in track["cast"]} | {track["assistant"]["id"]}
problems = []
def walk_cond(c, d, tasks, trig, chats):
    if not isinstance(c, dict): problems.append(f"day{d}: bad cond {c}"); return
    for k, v in c.items():
        if k in ("all", "any"):
            for x in v: walk_cond(x, d, tasks, trig, chats)
        elif k in ("task_done", "submitted"):
            if v not in tasks: problems.append(f"day{d}: unknown task {v}")
        elif k == "trigger_fired":
            if v not in trig: problems.append(f"day{d}: unknown trigger {v}")
        elif k == "messages_sent":
            if v["to"] not in cast | chats: problems.append(f"day{d}: unknown to {v['to']}")
        elif k == "counter_at_least":
            who = v["counter"].split(".")[0]
            if who not in cast | chats: problems.append(f"day{d}: unknown counter {v['counter']}")
        else: problems.append(f"day{d}: unknown condition {k}")
for e in track["days"]:
    p = os.path.join(root, e["file"]); d = json.load(open(p))
    assert d["day"] == e["day"]
    chars = {c["id"] for c in d["characters"]}
    for c in chars:
        if c not in cast: problems.append(f"day{d['day']}: char {c} not in cast")
    chats = {g["id"] for g in d.get("group_chats", [])}
    for g in d.get("group_chats", []):
        for m in g["members"]:
            if m not in chars: problems.append(f"day{d['day']}: group member {m} not in day characters")
    tasks = {t["id"] for t in d["tasks"]}; trig = {t["id"] for t in d["triggers"]}
    for t in d["tasks"]:
        walk_cond(t["done_when"], d["day"], tasks, trig, chats | chars)
        st = t.get("submit_to")
        if t["kind"] == "submission" and st not in chars | chats: problems.append(f"day{d['day']}: submit_to {st}")
    for t in d["triggers"]:
        walk_cond(t["when"], d["day"], tasks, trig, chats | chars)
        for a in t["do"]:
            k, v = next(iter(a.items()))
            if k == "message" and v["from"] not in chars: problems.append(f"day{d['day']}: message from {v['from']} not in day")
            if k == "ai_reply" and v["from"] not in chars: problems.append(f"day{d['day']}: ai_reply from {v['from']}")
            if k == "unlock" and v not in chars | chats: problems.append(f"day{d['day']}: unlock {v}")
    for s in d["clock"]["steps"]: walk_cond(s["when"], d["day"], tasks, trig, chats | chars)
    for k in d["scoring"]["expected_answers"]:
        if k not in tasks: problems.append(f"day{d['day']}: expected answer for unknown task {k}")
    for k in tasks:
        if k not in d["scoring"]["expected_answers"]: problems.append(f"day{d['day']}: no expected answer for {k}")
    print(f"day {d['day']:2}: ok-parsed, {len(chars)} characters, {len(d['tasks'])} tasks, {len(d['triggers'])} triggers, {sum(len(c.get('hidden_facts',[])) for c in d['characters'])} hidden facts")
print("PROBLEMS:" if problems else "No problems found.")
for x in problems: print(" -", x)
