# Grade Ledger — Backend Setup Guide

Follow these steps exactly, in order. Every command is explained.

---

## Step 1: Open your terminal

- **Windows**: Press `Win + R`, type `cmd`, press Enter
- **Mac**: Press `Cmd + Space`, type `Terminal`, press Enter

---

## Step 2: Navigate to the backend folder

Type this command and press Enter (replace the path with wherever you saved the project):

```
cd path\to\gradeledger\backend
```

For example, if you saved it on your Desktop:
```
cd C:\Users\YourName\Desktop\gradeledger\backend
```

---

## Step 3: Create a virtual environment

A virtual environment keeps this project's packages separate from other Python projects on your PC.

```
python -m venv venv
```

You'll see a new folder called `venv` appear. That's correct.

---

## Step 4: Activate the virtual environment

**Windows:**
```
venv\Scripts\activate
```

**Mac/Linux:**
```
source venv/bin/activate
```

You'll see `(venv)` appear at the start of your terminal line. That means it worked.

---

## Step 5: Install the required packages

```
pip install -r requirements.txt
```

This will download and install everything the backend needs. It may take a minute.

---

## Step 6: Start the server

```
uvicorn main:app --reload
```

You should see output like:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Started reloader process
✓ Default admin account created. Username: admin, Password: admin123
```

The `--reload` flag means the server automatically restarts when you change a file.
This is useful during development.

---

## Step 7: Confirm it's working

Open your browser and go to:
```
http://localhost:8000
```

You should see: `{"status":"Grade Ledger API is running","version":"1.0.0"}`

Also visit:
```
http://localhost:8000/docs
```

This is the interactive API documentation — you can test every endpoint here.

---

## Default Admin Credentials

```
Username: admin
Password: admin123
```

**IMPORTANT: Change this password before showing the system to anyone.**

---

## What gets created automatically

When the server starts for the first time:
- A file called `gradeledger.db` is created in the backend folder
- This is your entire database — all tables, all data, in one file
- Back this file up regularly

---

## Stopping the server

Press `Ctrl + C` in the terminal.

---

## Starting again next time

Every time you come back, you only need Steps 4 and 6:
1. Activate the virtual environment (`venv\Scripts\activate`)
2. Start the server (`uvicorn main:app --reload`)

---

## Project Structure

```
gradeledger/
├── backend/
│   ├── main.py          ← The API server (all routes)
│   ├── database.py      ← Database tables and setup
│   ├── crypto.py        ← Key derivation, signing, hashing
│   ├── auth.py          ← Password hashing, JWT tokens
│   ├── schemas.py       ← Request/response data shapes
│   ├── requirements.txt ← Package list
│   ├── README.md        ← This file
│   └── gradeledger.db   ← Created automatically on first run
└── frontend/            ← React app (Phase 3)
```
