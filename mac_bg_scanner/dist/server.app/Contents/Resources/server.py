#!/usr/bin/env python3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import urllib.parse

from installed_apps import get_installed_apps
from scanner import mac_get_permission_score

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
async def ping():
    return JSONResponse(content={"status": "ok"})

@app.get("/api/privacy/installed-apps-mac")
async def installed_apps():
    try:
        apps = get_installed_apps()
        scored_apps = []
        for app_info in apps:
            score_info = mac_get_permission_score(app_info["path"])
            merged = {**app_info, **score_info}
            scored_apps.append(merged)
        data = {"installedApps": scored_apps}
        return JSONResponse(content=data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)})

@app.get("/api/privacy/permissions-mac/{app_path:path}")
async def permissions_mac(app_path: str):
    decoded_path = urllib.parse.unquote(app_path)
    score_info = mac_get_permission_score(decoded_path)
    return JSONResponse(content=score_info)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5010)
