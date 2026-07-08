"""
Clashcourse backend.

Takes a set of courses (each with one or more components, each with one or
more possible time options) and searches for every clash-free way to pick
one option per component. Returns the best timetable by two metrics:
fewest days on campus, and smallest total gap time between classes.
"""

import os

from flask import Flask, request, jsonify, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__, static_folder="static", static_url_path="")

# --- Security hardening -----------------------------------------------------

# Cap request body size so nobody can POST a huge payload to eat memory/bandwidth.
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB

# Basic rate limiting — the search is CPU-intensive, so this stops one visitor
# from spamming the endpoint and slowing the app down for everyone else.
limiter = Limiter(get_remote_address, app=app, default_limits=["30 per minute"])

# Input caps enforced before the search runs at all, not just once it's inside
# the (already-capped) backtracking search.
MAX_COURSES = 20
MAX_COMPONENTS_PER_COURSE = 10
MAX_OPTIONS_PER_COMPONENT = 15

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

CAP = 4000          # max valid combinations to collect
NODE_CAP = 300_000  # max search-tree nodes to explore, safety valve


def to_min(t: str) -> int:
    """'HH:MM' -> minutes since midnight."""
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def validate_request_shape(data):
    """Structural validation of the incoming JSON, run before any real work.

    Returns an error string if the payload is malformed or oversized,
    otherwise None.
    """
    if not isinstance(data, dict):
        return "Invalid request body."

    courses = data.get("courses")
    if not isinstance(courses, list):
        return "\"courses\" must be a list."
    if len(courses) > MAX_COURSES:
        return f"Too many courses (max {MAX_COURSES})."

    for course in courses:
        if not isinstance(course, dict):
            return "Each course must be an object."
        if not isinstance(course.get("name"), str):
            return "Each course needs a \"name\" string."

        components = course.get("components", [])
        if not isinstance(components, list):
            return f'"{course.get("name")}" has an invalid components list.'
        if len(components) > MAX_COMPONENTS_PER_COURSE:
            return f'"{course.get("name")}" has too many components (max {MAX_COMPONENTS_PER_COURSE}).'

        for comp in components:
            if not isinstance(comp, dict):
                return "Each component must be an object."
            options = comp.get("options", [])
            if not isinstance(options, list):
                return f'"{comp.get("name")}" has an invalid options list.'
            if len(options) > MAX_OPTIONS_PER_COMPONENT:
                return f'"{comp.get("name")}" has too many time options (max {MAX_OPTIONS_PER_COMPONENT}).'

            for slot in options:
                if not isinstance(slot, dict):
                    return "Each time option must be an object."
                if slot.get("day") not in DAYS:
                    return f'Invalid day "{slot.get("day")}" — must be one of {DAYS}.'
                for field in ("start", "end"):
                    val = slot.get(field)
                    if not isinstance(val, str) or ":" not in val:
                        return f'Invalid "{field}" time format — expected "HH:MM".'
                    try:
                        h, m = val.split(":")
                        if not (0 <= int(h) <= 23 and 0 <= int(m) <= 59):
                            raise ValueError
                    except ValueError:
                        return f'Invalid "{field}" time value — expected "HH:MM".'

    return None


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
@limiter.limit("30 per minute")
def api_generate():
    data = request.get_json(silent=True)
    error = validate_request_shape(data)
    if error:
        return jsonify({"ok": False, "error": error}), 400

    result = generate_timetables(data["courses"])
    return jsonify(result)


if __name__ == "__main__":
    # debug=True is fine for local testing (python3 app.py) since production
    # runs via `gunicorn app:app`, which never executes this block at all.
    # Kept behind an env var anyway so it can't accidentally be left on if
    # someone ever does run this file directly on a real server.
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug_mode, port=5000)
