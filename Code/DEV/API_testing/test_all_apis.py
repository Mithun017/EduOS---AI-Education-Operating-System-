import os
import sys
import time
import json
import base64
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

# Color terminal output formatting
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def load_env():
    """Locate and load .env file from local or backend directory."""
    possible_paths = [
        Path(__file__).parent / ".env",
        Path(__file__).parent.parent / "backend" / ".env",
        Path(__file__).parent.parent.parent / ".env",
    ]
    env_found = False
    for p in possible_paths:
        if p.exists():
            print(f"{CYAN}Loading environment variables from: {p}{RESET}")
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip("'\"")
            env_found = True
            break
    if not env_found:
        print(f"{YELLOW}Warning: No .env file found in search paths. Reading system environment variables.{RESET}")

def test_nvidia_nim():
    """Test Priority 1: NVIDIA NIM API Key."""
    key = os.getenv("NVIDIA_NIM_API_KEY")
    base_url = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
    if not key:
        return "SKIPPED", "NVIDIA_NIM_API_KEY is not set in .env", 0

    url = f"{base_url.rstrip('/')}/models"
    headers = {
        "Authorization": f"Bearer {key}",
        "User-Agent": "EduOS-Diagnostic/1.0"
    }

    start = time.time()
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=12) as resp:
            latency = int((time.time() - start) * 1000)
            if resp.status == 200:
                return "PASS", f"NVIDIA NIM responding OK ({latency}ms)", latency
            return "FAIL", f"HTTP Status {resp.status}", latency
    except urllib.error.HTTPError as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", f"HTTP Error {e.code}: {e.reason}", latency
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", str(e), latency

def test_groq():
    """Test Priority 2: Groq API Key."""
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return "SKIPPED", "GROQ_API_KEY is not set in .env", 0

    url = "https://api.groq.com/openai/v1/models"
    headers = {
        "Authorization": f"Bearer {key}",
        "User-Agent": "EduOS-Diagnostic/1.0"
    }

    start = time.time()
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            latency = int((time.time() - start) * 1000)
            if resp.status == 200:
                return "PASS", f"Groq LLM responding OK ({latency}ms)", latency
            return "FAIL", f"HTTP Status {resp.status}", latency
    except urllib.error.HTTPError as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", f"HTTP Error {e.code}: {e.reason}", latency
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", str(e), latency

def test_gemini():
    """Test Priority 3: Google Gemini API Key."""
    key = os.getenv("GOOGLE_GEMINI_API_KEY")
    if not key:
        return "SKIPPED", "GOOGLE_GEMINI_API_KEY is not set in .env", 0

    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
    start = time.time()
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            latency = int((time.time() - start) * 1000)
            if resp.status == 200:
                return "PASS", f"Gemini API responding OK ({latency}ms)", latency
            return "FAIL", f"HTTP Status {resp.status}", latency
    except urllib.error.HTTPError as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", f"HTTP Error {e.code}: {e.reason}", latency
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", str(e), latency

def test_tavily():
    """Test Tavily Web Search Intelligence Key."""
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return "SKIPPED", "TAVILY_API_KEY is not set in .env", 0

    url = "https://api.tavily.com/search"
    headers = {"Content-Type": "application/json"}
    payload = json.dumps({
        "api_key": key,
        "query": "EduOS AI Education",
        "max_results": 1
    }).encode("utf-8")

    start = time.time()
    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            latency = int((time.time() - start) * 1000)
            if resp.status == 200:
                return "PASS", f"Tavily Search API responding OK ({latency}ms)", latency
            return "FAIL", f"HTTP Status {resp.status}", latency
    except urllib.error.HTTPError as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", f"HTTP Error {e.code}: {e.reason}", latency
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", str(e), latency

def test_cloudinary():
    """Test Cloudinary Storage Credentials."""
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not cloud_name or not api_key or not api_secret:
        return "SKIPPED", "Cloudinary credentials missing in .env", 0

    url = f"https://api.cloudinary.com/v1_1/{cloud_name}/ping"
    auth_str = base64.b64encode(f"{api_key}:{api_secret}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_str}"
    }

    start = time.time()
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            latency = int((time.time() - start) * 1000)
            if resp.status == 200:
                return "PASS", f"Cloudinary ping successful ({cloud_name}) ({latency}ms)", latency
            return "FAIL", f"HTTP Status {resp.status}", latency
    except urllib.error.HTTPError as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", f"HTTP Error {e.code}: {e.reason}", latency
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return "FAIL", str(e), latency

def main():
    print(f"\n{BOLD}{CYAN}============================================================{RESET}")
    print(f"{BOLD}{CYAN}      EduOS AI & Storage Provider Health Diagnostic       {RESET}")
    print(f"{BOLD}{CYAN}============================================================{RESET}\n")

    load_env()

    tests = [
        ("NVIDIA NIM LLM (Priority 1)", test_nvidia_nim),
        ("Groq LLM (Priority 2)", test_groq),
        ("Google Gemini (Priority 3)", test_gemini),
        ("Tavily Web Search Intelligence", test_tavily),
        ("Cloudinary Object Storage", test_cloudinary),
    ]

    results = []
    total_pass = 0

    for name, test_func in tests:
        print(f"Testing {BOLD}{name}{RESET}...", end=" ", flush=True)
        status, details, latency = test_func()
        results.append((name, status, details, latency))

        if status == "PASS":
            print(f"[{GREEN}{BOLD}PASS{RESET}] - {details}")
            total_pass += 1
        elif status == "FAIL":
            print(f"[{RED}{BOLD}FAIL{RESET}] - {details}")
        else:
            print(f"[{YELLOW}{BOLD}SKIP{RESET}] - {details}")

    print(f"\n{BOLD}{CYAN}============================================================{RESET}")
    print(f"{BOLD}Diagnostic Summary: {GREEN}{total_pass}/{len(tests)} APIs Passed{RESET}")
    print(f"{BOLD}{CYAN}============================================================{RESET}\n")

if __name__ == "__main__":
    main()
