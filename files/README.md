# Adjudante

I created Adjudante to help build my university timetable for me, without having to worry about clashes,
being in class every day or having massive breaks between classes. To use Adjudante, simply copy and paste
in all of the possible timeslots for your classes and let it create timetable options for you ensuring no clashes
and a schedule that suits YOUR time. 

## Stack

- **Python (Flask)** — `app.py` does the actual work: a backtracking search
  over every possible combination of class times, pruned as soon as two
  sessions clash, then scored by two metrics (days on campus, total gap
  time).
- **HTML/JavaScript** — `static/index.html` and `static/app.js` build the
  course-entry form in the browser and call the Python backend over a small
  JSON API (`POST /api/generate`).
- **Markdown** — this file.

## Project structure

```
clashcourse-app/
├── app.py              # Flask app + timetable search logic
├── requirements.txt
├── README.md
└── static/
    ├── index.html      # page shell
    ├── style.css
    └── app.js          # course-builder UI + calls /api/generate
```

## Running it locally

```bash
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt
python3 app.py
```

Then open **http://localhost:5000** in a browser.

## How the search works

Each course is made of one or more **components** (Lecture, Tutorial, Prac —
or just one component if the course only meets once), and each component
has one or more possible time **options**. The backend:

1. Flattens every component across every course into a single list.
2. Recursively tries one option per component, skipping any option that
   overlaps a class already placed on that day (backtracking, so it prunes
   early instead of generating every combination up front).
3. Scores every clash-free combination it finds by:
   - **days used** — how many distinct weekdays involve a class
   - **total gap** — minutes spent on campus between classes, summed across
     the week
4. Returns the top 30 combinations sorted each way, so the frontend can also
   let you page through alternatives, not just see the single best one.

Two safety caps prevent pathological inputs (e.g. 15 classes with 6 time
options each) from hanging the server: it stops collecting after 4,000 valid
timetables, and stops searching after 300,000 tree nodes either way.

## Deploying it

This is a real Python backend, not a static site, so it needs a host that
runs Python — static hosts like Netlify or GitHub Pages won't work as-is.
Options that do:

- **Render** or **Railway** — free tiers, connect a GitHub repo, they detect
  `app.py` + `requirements.txt` automatically.
- **PythonAnywhere** — free tier aimed specifically at small Flask/Python
  apps.

Whichever you pick, set the start command to something like:
```
gunicorn app:app
```
(add `gunicorn` to `requirements.txt` for production — Flask's built-in
server used in `app.run()` isn't meant for real traffic.)

## Known limitations

- Class times are entered manually — it doesn't pull from the university's
  timetable system.
- No login or saved timetables between sessions yet — each visit starts
  fresh.
