import os
import sys
import time
import json
import base64
import requests
import streamlit as st
from pathlib import Path

# Set page configuration
st.set_page_config(
    page_title="EduOS API Interactive Playground",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for dark aesthetic
st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(90deg, #10B981, #3B82F6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1.0rem;
        color: #9CA3AF;
        margin-bottom: 1.5rem;
    }
    .card {
        background-color: #1F2937;
        border-radius: 8px;
        padding: 1.2rem;
        border: 1px solid #374151;
        margin-bottom: 1rem;
    }
    .badge-pass {
        background-color: #065F46;
        color: #34D399;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .badge-fail {
        background-color: #7F1D1D;
        color: #F87171;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .badge-skip {
        background-color: #78350F;
        color: #FBBF24;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.85rem;
    }
</style>
""", unsafe_allow_html=True)

# Load environment variables
def load_env_vars():
    possible_paths = [
        Path(__file__).parent / ".env",
        Path(__file__).parent.parent / "backend" / ".env",
        Path(__file__).parent.parent.parent / ".env",
    ]
    for p in possible_paths:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip("'\"")
            return str(p)
    return None

env_file_loaded = load_env_vars()

# App Header
st.markdown("<div class='main-header'>🎓 EduOS API Interactive Testing Playground</div>", unsafe_allow_html=True)
st.markdown(f"<div class='sub-header'>Test, prompt, and benchmark all AI providers, storage, and FastAPI endpoints. <b>Environment:</b> <code>{env_file_loaded or 'System Env'}</code></div>", unsafe_allow_html=True)

# Sidebar Configuration
with st.sidebar:
    st.header("⚙️ API Configuration")
    st.subheader("Loaded Keys Summary")
    
    nim_key = os.getenv("NVIDIA_NIM_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")
    gemini_key = os.getenv("GOOGLE_GEMINI_API_KEY", "")
    tavily_key = os.getenv("TAVILY_API_KEY", "")
    cloudinary_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    backend_url = st.text_input("Backend API Base URL", value="http://127.0.0.1:8000")

    st.markdown("---")
    st.markdown(f"**NVIDIA NIM Key:** `{'✓ Set' if nim_key else '❌ Missing'}`")
    st.markdown(f"**Groq Key:** `{'✓ Set' if groq_key else '❌ Missing'}`")
    st.markdown(f"**Gemini Key:** `{'✓ Set' if gemini_key else '❌ Missing'}`")
    st.markdown(f"**Tavily Key:** `{'✓ Set' if tavily_key else '❌ Missing'}`")
    st.markdown(f"**Cloudinary:** `{'✓ Set' if cloudinary_name else '❌ Missing'}`")

# Tabs Navigation
tab_health, tab_nim, tab_groq, tab_gemini, tab_tavily, tab_cloudinary, tab_backend = st.tabs([
    "📊 Health Dashboard",
    "🟢 NVIDIA NIM",
    "⚡ Groq LLM",
    "✨ Google Gemini",
    "🌐 Tavily Search",
    "☁️ Cloudinary",
    "🚀 EduOS Backend API"
])

# ---------------------------------------------------------
# TAB 1: Health Dashboard
# ---------------------------------------------------------
with tab_health:
    st.subheader("System Provider Health Diagnostic")
    st.write("Run automated health checks across all external AI, search, storage, and local backend APIs.")
    
    if st.button("🔄 Run All Health Diagnostics", type="primary", use_container_width=True):
        results = []
        
        # 1. NVIDIA NIM
        with st.spinner("Testing NVIDIA NIM..."):
            start = time.time()
            try:
                base = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip('/')
                res = requests.get(f"{base}/models", headers={"Authorization": f"Bearer {nim_key}"}, timeout=8)
                lat = int((time.time() - start) * 1000)
                status = "PASS" if res.status_code == 200 else "FAIL"
                msg = f"NVIDIA NIM responding ({lat}ms)" if status == "PASS" else f"HTTP {res.status_code}"
            except Exception as e:
                lat = int((time.time() - start) * 1000)
                status, msg = "FAIL", str(e)
            results.append(("NVIDIA NIM LLM", status, msg, lat))

        # 2. Groq
        with st.spinner("Testing Groq LLM..."):
            start = time.time()
            try:
                res = requests.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {groq_key}"}, timeout=8)
                lat = int((time.time() - start) * 1000)
                status = "PASS" if res.status_code == 200 else "FAIL"
                msg = f"Groq API responding ({lat}ms)" if status == "PASS" else f"HTTP {res.status_code}"
            except Exception as e:
                lat = int((time.time() - start) * 1000)
                status, msg = "FAIL", str(e)
            results.append(("Groq LLM API", status, msg, lat))

        # 3. Gemini
        with st.spinner("Testing Google Gemini..."):
            start = time.time()
            try:
                res = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}", timeout=8)
                lat = int((time.time() - start) * 1000)
                status = "PASS" if res.status_code == 200 else "FAIL"
                msg = f"Gemini API responding ({lat}ms)" if status == "PASS" else f"HTTP {res.status_code}"
            except Exception as e:
                lat = int((time.time() - start) * 1000)
                status, msg = "FAIL", str(e)
            results.append(("Google Gemini API", status, msg, lat))

        # 4. Tavily
        with st.spinner("Testing Tavily Search..."):
            start = time.time()
            try:
                res = requests.post("https://api.tavily.com/search", json={"api_key": tavily_key, "query": "EduOS", "max_results": 1}, timeout=8)
                lat = int((time.time() - start) * 1000)
                status = "PASS" if res.status_code == 200 else "FAIL"
                msg = f"Tavily Search responding ({lat}ms)" if status == "PASS" else f"HTTP {res.status_code}"
            except Exception as e:
                lat = int((time.time() - start) * 1000)
                status, msg = "FAIL", str(e)
            results.append(("Tavily Web Search", status, msg, lat))

        # 5. Cloudinary
        with st.spinner("Testing Cloudinary..."):
            start = time.time()
            try:
                sec = os.getenv("CLOUDINARY_API_SECRET", "")
                k = os.getenv("CLOUDINARY_API_KEY", "")
                auth_str = base64.b64encode(f"{k}:{sec}".encode()).decode()
                res = requests.get(f"https://api.cloudinary.com/v1_1/{cloudinary_name}/ping", headers={"Authorization": f"Basic {auth_str}"}, timeout=8)
                lat = int((time.time() - start) * 1000)
                status = "PASS" if res.status_code == 200 else "FAIL"
                msg = f"Cloudinary ping OK ({lat}ms)" if status == "PASS" else f"HTTP {res.status_code}"
            except Exception as e:
                lat = int((time.time() - start) * 1000)
                status, msg = "FAIL", str(e)
            results.append(("Cloudinary Storage", status, msg, lat))

        # 6. EduOS FastAPI Backend
        with st.spinner("Testing EduOS Backend API..."):
            start = time.time()
            try:
                res = requests.get(f"{backend_url.rstrip('/')}/health", timeout=5)
                lat = int((time.time() - start) * 1000)
                status = "PASS" if res.status_code == 200 else "FAIL"
                msg = f"EduOS FastAPI healthy ({lat}ms)" if status == "PASS" else f"HTTP {res.status_code}"
            except Exception as e:
                lat = int((time.time() - start) * 1000)
                status, msg = "FAIL", f"Backend unreachable: {e}"
            results.append(("EduOS FastAPI Backend", status, msg, lat))

        # Render Results Grid
        cols = st.columns(3)
        for idx, (name, status, msg, lat) in enumerate(results):
            with cols[idx % 3]:
                badge = "<span class='badge-pass'>PASS</span>" if status == "PASS" else "<span class='badge-fail'>FAIL</span>"
                st.markdown(f"""
                <div class='card'>
                    <h4>{name}</h4>
                    <p>{badge} &nbsp; <b>{lat} ms</b></p>
                    <p><small>{msg}</small></p>
                </div>
                """, unsafe_allow_html=True)

# ---------------------------------------------------------
# TAB 2: NVIDIA NIM
# ---------------------------------------------------------
with tab_nim:
    st.subheader("🟢 NVIDIA NIM Interactive Prompting")
    col1, col2 = st.columns([1, 2])
    with col1:
        nim_model = st.selectbox("Model", ["meta/llama-3.1-8b-instruct", "meta/llama-3.3-70b-instruct"])
        nim_temp = st.slider("Temperature", 0.0, 1.0, 0.2, 0.1, key="nim_temp")
        nim_max_tokens = st.number_input("Max Tokens", 100, 2000, 500, key="nim_max")
    with col2:
        nim_prompt = st.text_area("Prompt", "Explain the concept of Convolutional Neural Networks (CNN) in simple terms.", height=120)
        if st.button("🚀 Generate with NVIDIA NIM", type="primary"):
            with st.spinner("Calling NVIDIA NIM API..."):
                start = time.time()
                try:
                    base = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip('/')
                    payload = {
                        "model": nim_model,
                        "messages": [{"role": "user", "content": nim_prompt}],
                        "temperature": nim_temp,
                        "max_tokens": nim_max_tokens
                    }
                    res = requests.post(f"{base}/chat/completions", headers={"Authorization": f"Bearer {nim_key}", "Content-Type": "application/json"}, json=payload, timeout=20)
                    lat = int((time.time() - start) * 1000)
                    if res.status_code == 200:
                        data = res.json()
                        st.success(f"Response Received in {lat} ms")
                        st.markdown(data["choices"][0]["message"]["content"])
                        with st.expander("View Raw JSON Response"):
                            st.json(data)
                    else:
                        st.error(f"HTTP {res.status_code}: {res.text}")
                except Exception as e:
                    st.error(f"Error calling NVIDIA NIM: {e}")

# ---------------------------------------------------------
# TAB 3: Groq LLM
# ---------------------------------------------------------
with tab_groq:
    st.subheader("⚡ Groq LLM Ultra-Fast Inference")
    col1, col2 = st.columns([1, 2])
    with col1:
        groq_model = st.selectbox("Groq Model", ["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192"])
        groq_temp = st.slider("Temperature", 0.0, 1.0, 0.2, 0.1, key="groq_temp")
        groq_max_tokens = st.number_input("Max Tokens", 100, 2000, 500, key="groq_max")
    with col2:
        groq_prompt = st.text_area("Prompt", "Create a 3-step learning roadmap for Machine Learning.", height=120)
        if st.button("⚡ Generate with Groq", type="primary"):
            with st.spinner("Calling Groq LLM API..."):
                start = time.time()
                try:
                    payload = {
                        "model": groq_model,
                        "messages": [{"role": "user", "content": groq_prompt}],
                        "temperature": groq_temp,
                        "max_tokens": groq_max_tokens
                    }
                    res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}, json=payload, timeout=15)
                    lat = int((time.time() - start) * 1000)
                    if res.status_code == 200:
                        data = res.json()
                        st.success(f"Response Received in {lat} ms")
                        st.markdown(data["choices"][0]["message"]["content"])
                        with st.expander("View Raw JSON Response"):
                            st.json(data)
                    else:
                        st.error(f"HTTP {res.status_code}: {res.text}")
                except Exception as e:
                    st.error(f"Error calling Groq: {e}")

# ---------------------------------------------------------
# TAB 4: Google Gemini
# ---------------------------------------------------------
with tab_gemini:
    st.subheader("✨ Google Gemini Multi-modal API")
    col1, col2 = st.columns([1, 2])
    with col1:
        gemini_model = st.selectbox("Gemini Model", ["gemini-2.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro"])
        gemini_sys = st.text_input("System Instruction", "You are an AI Education Assistant.")
    with col2:
        gemini_prompt = st.text_area("Prompt", "List 5 key points about Backpropagation in Deep Learning.", height=120)
        if st.button("✨ Generate with Gemini", type="primary"):
            with st.spinner("Calling Google Gemini API..."):
                start = time.time()
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [{"parts": [{"text": gemini_prompt}]}],
                        "system_instruction": {"parts": [{"text": gemini_sys}]}
                    }
                    res = requests.post(url, json=payload, timeout=15)
                    lat = int((time.time() - start) * 1000)
                    if res.status_code == 200:
                        data = res.json()
                        st.success(f"Response Received in {lat} ms")
                        text_resp = data["candidates"][0]["content"]["parts"][0]["text"]
                        st.markdown(text_resp)
                        with st.expander("View Raw Response"):
                            st.json(data)
                    else:
                        st.error(f"HTTP {res.status_code}: {res.text}")
                except Exception as e:
                    st.error(f"Error calling Gemini: {e}")

# ---------------------------------------------------------
# TAB 5: Tavily Search
# ---------------------------------------------------------
with tab_tavily:
    st.subheader("🌐 Tavily Real-Time Web Search Intelligence")
    col1, col2 = st.columns([1, 2])
    with col1:
        tavily_max = st.slider("Max Search Results", 1, 5, 3)
    with col2:
        tavily_query = st.text_input("Search Query", "Latest advancements in AI Education platforms 2026")
        if st.button("🌐 Execute Tavily Search", type="primary"):
            with st.spinner("Searching web via Tavily API..."):
                start = time.time()
                try:
                    payload = {
                        "api_key": tavily_key,
                        "query": tavily_query,
                        "max_results": tavily_max
                    }
                    res = requests.post("https://api.tavily.com/search", json=payload, timeout=10)
                    lat = int((time.time() - start) * 1000)
                    if res.status_code == 200:
                        data = res.json()
                        st.success(f"Search Completed in {lat} ms")
                        for item in data.get("results", []):
                            st.markdown(f"### [{item.get('title')}]({item.get('url')})")
                            st.write(item.get("content"))
                            st.markdown("---")
                        with st.expander("View Raw JSON"):
                            st.json(data)
                    else:
                        st.error(f"HTTP {res.status_code}: {res.text}")
                except Exception as e:
                    st.error(f"Error executing Tavily search: {e}")

# ---------------------------------------------------------
# TAB 6: Cloudinary
# ---------------------------------------------------------
with tab_cloudinary:
    st.subheader("☁️ Cloudinary Object & Image Storage")
    st.write(f"Active Cloud Name: `'{cloudinary_name}'`")
    if st.button("☁️ Test Cloudinary Ping"):
        with st.spinner("Pinging Cloudinary API..."):
            sec = os.getenv("CLOUDINARY_API_SECRET", "")
            k = os.getenv("CLOUDINARY_API_KEY", "")
            auth_str = base64.b64encode(f"{k}:{sec}".encode()).decode()
            res = requests.get(f"https://api.cloudinary.com/v1_1/{cloudinary_name}/ping", headers={"Authorization": f"Basic {auth_str}"}, timeout=8)
            if res.status_code == 200:
                st.success("Cloudinary account ping successful!")
                st.json(res.json())
            else:
                st.error(f"Ping failed: HTTP {res.status_code}")

# ---------------------------------------------------------
# TAB 7: EduOS Backend API
# ---------------------------------------------------------
with tab_backend:
    st.subheader("🚀 EduOS FastAPI Backend Interactive Tester")
    st.write(f"Target API Base: `{backend_url}`")
    
    b_tab1, b_tab2, b_tab3 = st.tabs(["🔐 Auth Login", "📚 Academic Context", "👩‍🏫 Teacher Assistant Ask"])
    
    with b_tab1:
        role = st.selectbox("Role", ["teacher", "student"])
        if st.button("🔐 Login Demo User"):
            with st.spinner("Authenticating..."):
                email = "teacher@demo.eduos.ai" if role == "teacher" else "student@demo.eduos.ai"
                res = requests.post(f"{backend_url.rstrip('/')}/api/v1/auth/login", json={"email": email, "password": "password123"})
                if res.status_code == 200:
                    st.success("Authenticated Successfully!")
                    st.json(res.json())
                else:
                    st.error(f"HTTP {res.status_code}: {res.text}")

    with b_tab2:
        if st.button("📚 Fetch Academic Context"):
            with st.spinner("Fetching context..."):
                res = requests.get(f"{backend_url.rstrip('/')}/api/v1/academic/context")
                if res.status_code == 200:
                    st.success("Academic Context Loaded!")
                    st.json(res.json())
                else:
                    st.error(f"HTTP {res.status_code}: {res.text}")

    with b_tab3:
        ask_topic = st.text_input("Topic ID", "topic-core-001")
        ask_msg = st.text_area("Teacher Message", "Show roadmap for core principles", height=80)
        if st.button("👩‍🏫 Ask Teacher Assistant"):
            with st.spinner("Querying Teacher Assistant API..."):
                res = requests.post(
                    f"{backend_url.rstrip('/')}/api/v1/teacher-assistant/ask",
                    headers={"X-Tenant-ID": "demo-inst-001", "X-User-ID": "user-demo-001"},
                    json={"topic_id": ask_topic, "message": ask_msg}
                )
                if res.status_code == 200:
                    st.success("Teacher Assistant Response Received!")
                    st.json(res.json())
                else:
                    st.error(f"HTTP {res.status_code}: {res.text}")
