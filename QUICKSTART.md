# Quick Start Guide

## Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

## Setup Steps

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python main.py
```

The backend will run on `http://localhost:8000`

### 2. Frontend Setup

Open a new terminal:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will run on `http://localhost:5173`

### 3. Using the Application

1. Open your browser and go to `http://localhost:5173`
2. Click on "Home" in the navigation
3. Upload a CSV file with the required format (see `sample_data.csv` for reference)
4. Click "Upload File"
5. Click "Run Analysis" to process the data
6. Navigate to other pages to view:
   - **Graph View**: Interactive network visualization
   - **Metrics**: Charts and statistics
   - **Insights**: Summary and export options
   - **About**: Documentation

## Sample Data

A sample CSV file (`sample_data.csv`) is included in the root directory for testing.

## Troubleshooting

### Backend won't start
- Make sure port 8000 is not in use
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify Python version: `python --version` (should be 3.8+)

### Frontend won't start
- Make sure port 5173 is not in use
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 16+)

### API connection errors
- Ensure backend is running on port 8000
- Check CORS settings in `backend/main.py`
- Verify API URL in `frontend/src/services/api.js`

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore the API documentation at `http://localhost:8000/docs`
- Customize the similarity threshold in `backend/utils/graph_utils.py`

