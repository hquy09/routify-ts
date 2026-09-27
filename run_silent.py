import os
import sys
import time
import subprocess
import webbrowser

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

CREATE_NO_WINDOW = 0x08000000

def kill_port(port: int):
    try:
        cmd = f'netstat -aon | findstr ":{port}" | findstr "LISTENING"'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        for line in res.stdout.strip().splitlines():
            parts = line.split()
            if parts:
                pid = parts[-1]
                subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass

def main():
    # 1. Clean old processes on ports 8000 & 5173
    kill_port(8000)
    kill_port(5173)

    # 2. Start Backend (FastAPI - must use python.exe, not pythonw.exe, for uvicorn)
    venv_py = os.path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")
    if os.path.exists(venv_py):
        py_exe = venv_py
    else:
        py_exe = sys.executable
        if py_exe.lower().endswith("pythonw.exe"):
            py_exe = py_exe[:-5] + ".exe"

    backend_cmd = [py_exe, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=BACKEND_DIR,
        creationflags=CREATE_NO_WINDOW
    )

    # 3. Start Frontend (Vite)
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=True,
        creationflags=CREATE_NO_WINDOW
    )

    # 4. Wait 3 seconds and open browser
    time.sleep(3)
    try:
        webbrowser.open("http://localhost:5173/")
    except Exception:
        pass

    # 5. Keep alive in background quietly (0% CPU)
    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None and frontend_proc.poll() is not None:
                break
    except Exception:
        pass

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        with open(os.path.join(ROOT_DIR, "run_silent_err.txt"), "w", encoding="utf-8") as f:
            f.write(traceback.format_exc())

