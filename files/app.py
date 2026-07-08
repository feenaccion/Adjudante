"""
Clashcourse backend.

Takes a set of courses (each with one or more components, each with one or
more possible time options) and searches for every clash-free way to pick
one option per component. Returns the best timetable by two metrics:
fewest days on campus, and smallest total gap time between classes.
"""

from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="")

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

CAP = 4000          # max valid combinations to collect
NODE_CAP = 300_000  # max search-tree nodes to explore, safety valve


def to_min(t: str) -> int:
    """'HH:MM' -> minutes since midnight."""
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def generate_timetables(courses):
    # Flatten every (course, component) pair that needs exactly one option chosen.
    flat = []
    for course in courses:
        for comp in course.get("components", []):
            options = comp.get("options", [])
            if not options:
                return {
                    "ok": False,
                    "error": f'"{course["name"]} — {comp["name"]}" has no time options. '
                             f"Add at least one.",
                }
            flat.append((course, comp))

    if not flat:
        return {"ok": False, "error": "Add at least one course with a class time first."}

    total_combos = 1
    for _, comp in flat:
        total_combos *= len(comp["options"])

    busy = {d: [] for d in DAYS}
    valid = []
    state = {"truncated": False, "nodes": 0}

    def overlaps(day, start, end):
        return any(start < s[1] and end > s[0] for s in busy[day])

    def backtrack(i, chosen):
        if len(valid) >= CAP or state["truncated"]:
            state["truncated"] = True
            return
        state["nodes"] += 1
        if state["nodes"] > NODE_CAP:
            state["truncated"] = True
            return
        if i == len(flat):
            valid.append(list(chosen))
            return

        course, comp = flat[i]
        for slot in comp["options"]:
            start, end = to_min(slot["start"]), to_min(slot["end"])
            if end <= start:
                continue  # invalid slot, skip
            if overlaps(slot["day"], start, end):
                continue
            busy[slot["day"]].append((start, end))
            chosen.append({"course": course, "comp": comp, "slot": slot})
            backtrack(i + 1, chosen)
            chosen.pop()
            busy[slot["day"]].pop()
            if len(valid) >= CAP or state["truncated"]:
                return

    backtrack(0, [])

    if not valid:
        return {
            "ok": False,
            "no_solution": True,
            "error": f"No clash-free combination exists across {total_combos} possible "
                     f"combos. Try adding more time options for at least one class.",
        }

    scored = []
    for chosen in valid:
        by_day = {}
        for c in chosen:
            slot = c["slot"]
            by_day.setdefault(slot["day"], []).append((to_min(slot["start"]), to_min(slot["end"])))
        days_used, total_gap = 0, 0
        for d in DAYS:
            sessions = by_day.get(d)
            if not sessions:
                continue
            days_used += 1
            sessions.sort()
            for k in range(1, len(sessions)):
                total_gap += max(0, sessions[k][0] - sessions[k - 1][1])
        scored.append({"chosen": chosen, "daysUsed": days_used, "totalGap": total_gap})

    by_days = sorted(scored, key=lambda s: (s["daysUsed"], s["totalGap"]))
    by_gap = sorted(scored, key=lambda s: (s["totalGap"], s["daysUsed"]))

    combos_text = str(total_combos) if total_combos <= 100_000 else "a very large number of"
    return {
        "ok": True,
        "message": (
            f"Found {len(valid)}{'+' if state['truncated'] else ''} clash-free "
            f"timetable(s) out of {combos_text} combinations checked."
        ),
        "byDays": by_days[:30],
        "byGap": by_gap[:30],
    }


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/generate", methods=["POST"])
def api_generate():
    data = request.get_json(force=True) or {}
    courses = data.get("courses", [])
    result = generate_timetables(courses)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
