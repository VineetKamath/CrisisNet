from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv
import pandas as pd
import os
from pathlib import Path
from routes import router, init_state
from models import AnalysisState

load_dotenv()

app = FastAPI(
    title="CrisisNet API",
    description="Social Network Analysis Platform for Disaster Information Flow",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state for analysis results
analysis_state = AnalysisState()

# Initialize state in routes
init_state(analysis_state)

# Include routes
app.include_router(router)

@app.get("/")
async def root():
    return {
        "message": "CrisisNet API - Social Network Analysis Platform",
        "version": "1.0.0",
        "endpoints": {
            "POST /upload": "Upload CSV file",
            "GET /analyze": "Run SNA analysis",
            "GET /graph": "Get graph data (nodes & edges)",
            "GET /summary": "Get textual insights",
            "GET /download": "Download results as CSV/PDF"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

