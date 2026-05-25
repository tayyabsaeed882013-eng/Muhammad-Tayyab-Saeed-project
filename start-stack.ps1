# Start Full Stack - EEG Medical Diagnosis System
# This script starts both the backend API and frontend development server

Write-Host "Starting Medical Diagnosis System Stack..." -ForegroundColor Green
Write-Host ""

# Start Backend API in new window
Write-Host "Starting Backend API..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\project 1\eeg_api'; .\venv312\Scripts\python.exe app.py"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start Frontend in new window
Write-Host "Starting Frontend Development Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\project 1\project'; npm run dev"

Write-Host ""
Write-Host "Stack started successfully!" -ForegroundColor Green
Write-Host "Backend API: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend App: http://localhost:5174" -ForegroundColor Yellow
