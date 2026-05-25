# EEG Diagnosis System - Full Stack Medical Application

**Final Year Project** | Medical EEG Analysis & AI Diagnosis System

## 📋 Project Overview

A **full-stack web application** that analyzes EEG (electroencephalogram) signals and provides AI-powered diagnosis predictions for 7 different sleep/neurological disorders:

- Healthy
- Insomnia
- Narcolepsy
- NFLE (Nocturnal Frontal Lobe Epilepsy)
- PLM (Periodic Leg Movement)
- RBD (REM Sleep Behavior Disorder)
- SDB (Sleep Disordered Breathing)

**Key Features:**

- 🧠 TensorFlow/Keras neural network for EEG classification
- 📊 Real-time diagnosis prediction with confidence scores
- 👥 Patient management system
- 📁 EEG file upload and processing
- 📈 Reports generation with PDF/CSV export
- 🔐 User authentication (Supabase)
- 🎨 Modern React UI with Tailwind CSS

---

## 🏗️ Project Structure

```
project/
├── frontend/              # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/        # Main pages (Dashboard, Diagnosis, Reports, etc.)
│   │   ├── components/   # Reusable UI components
│   │   ├── lib/          # Supabase client
│   │   └── utils/        # Helper functions
│   └── vite.config.ts
│
├── eeg_api/               # Flask REST API server
│   ├── app.py            # Main Flask application
│   ├── predict.py        # TensorFlow model inference
│   ├── model/
│   │   ├── final_eeg_model.h5      # Trained neural network
│   │   ├── encoder.pkl             # Label encoder
│   │   ├── scaler.pkl              # StandardScaler
│   │   └── scaler_new.pkl          # Alternative scaler
│   ├── requirements.txt   # Python dependencies
│   └── venv312/          # Python virtual environment (not in GitHub)
│
└── Balanced Data/         # Training datasets (not in GitHub)
```

---

## 🔧 Tech Stack

### Frontend

- **React 18** + TypeScript
- **Vite** - Fast bundler
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Supabase JS Client** - Database & Auth

### Backend

- **Flask** - REST API server (Python 3.12)
- **TensorFlow/Keras** - Neural network model
- **Pandas** - Data processing
- **scikit-learn** - Preprocessing (StandardScaler, LabelEncoder)

### Database

- **Supabase PostgreSQL** - Patient data, diagnoses
- **Supabase Storage** - EEG CSV file uploads
- **Real-time subscriptions** - Live data updates

### ML Model

- **Input:** 1024-channel EEG signals from CSV files
- **Output:** 7-class diagnosis with confidence percentage
- **Loss Function:** Custom Focal Loss (for imbalanced data)
- **Validation Accuracy:** [Add your model's actual accuracy]

---

## 📦 Installation & Setup

### Prerequisites

- Node.js 16+ & npm
- Python 3.12
- Git

### 1️⃣ Clone Repository

```bash
git clone https://github.com/tayyabsaeed882013-eng/Muhammad-Tayyab-Saeed-project.git
cd Muhammad-Tayyab-Saeed-project
```

### 2️⃣ Setup Backend (Flask API)

```bash
cd eeg_api

# Create virtual environment
python -m venv venv312
venv312\Scripts\activate    # On Windows

# Install dependencies
pip install -r requirements.txt

# Start Flask server (runs on port 5000)
python app.py
```

### 3️⃣ Setup Frontend (React)

```bash
cd project

# Install dependencies
npm install

# Start dev server (runs on port 5174)
npm run dev
```

### 4️⃣ Setup Supabase (Database)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Copy `.env.example` to `.env.local`:
   ```bash
   cd project
   cp .env.example .env.local
   ```
4. Add your Supabase URL and API key to `.env.local`
5. Run migrations: `supabase migration up`

### 5️⃣ Access Application

- **Frontend:** http://localhost:5174
- **Backend API:** http://localhost:5000
- **API Health:** http://localhost:5000/health

---

## 🚀 Usage

### 1. Login / Register

- Create account with email and password
- Supabase authentication handles sessions

### 2. Add Patients

- Go to **Patients** page
- Click "Add Patient"
- Enter patient details (name, age, gender)

### 3. Run Diagnosis

- Go to **Diagnosis** page
- Select undiagnosed patient
- Upload EEG CSV file (max 2.5GB)
- Wait for prediction → Get diagnosis result with confidence %

### 4. View Results

- **EEGs Page:** Browse all diagnosis records with filtering
- **Reports Page:** View detailed reports, export PDF/CSV
- **Dashboard:** Summary stats and recent diagnoses

---

## 📊 Model Details

### Architecture

- **Type:** Deep Neural Network (TensorFlow/Keras)
- **Input Shape:** (1024,) - 1024 EEG channels
- **Output:** 7 classes (one-hot encoded)
- **Activation:** ReLU (hidden) + Softmax (output)

### Preprocessing

1. Read CSV file (first 1024 columns)
2. **StandardScaler** normalization
3. Reshape for model input
4. Predict with Keras model
5. **Confidence Calibration** (temperature scaling)

### Files

- `final_eeg_model.h5` - Trained model weights
- `encoder.pkl` - Maps class labels to disease names
- `scaler.pkl`, `scaler_new.pkl` - Data normalization

### Prediction API

```bash
POST /predict
Content-Type: multipart/form-data

# Returns:
{
  "predicted_label": "Healthy",
  "confidence": 98.5,
  "details": {
    "processing_time_ms": 234,
    "model_version": "v1.0"
  }
}
```

---

## 🗄️ Database Schema

### Tables

- **users** - User accounts (email, password)
- **patients** - Patient info (name, age, gender)
- **diagnoses** - Diagnosis records (patient_id, diagnosis, confidence, file_url, status)

### Real-time Features

- Subscribe to new diagnoses
- Live patient list updates
- Automatic cache invalidation

---

## 🔒 Security Features

- ✅ User authentication (Supabase Auth)
- ✅ Row-level security (RLS) policies
- ✅ Encrypted file uploads to cloud storage
- ✅ Protected API endpoints
- ✅ CORS enabled for frontend

---

## ⚡ Performance Optimizations

1. **CSV Reading** - Streams first 2 rows only (avoids loading entire file)
2. **Real-time Debouncing** - 1-second delay prevents cascade refetches
3. **Memoized Queries** - Reduces unnecessary API calls
4. **Progress Notifications** - Step-by-step feedback (📊 → 📁 → 💾 → 👤 → ✅)

---

## 🛠️ Development

### Run Both Servers (Development)

```bash
# Terminal 1 - Backend
cd eeg_api
python app.py

# Terminal 2 - Frontend
cd project
npm run dev
```

### Build for Production

```bash
# Frontend
cd project
npm run build

# Creates optimized dist/ folder for deployment
```

### Testing

```bash
# Test EEG prediction
cd eeg_api
python test_confidence.py
```

---

## 📝 Project Statistics

- **Frontend Lines:** ~3000+ (React/TypeScript)
- **Backend Lines:** ~500+ (Flask Python)
- **Database Queries:** 20+ (optimized with indexes)
- **Total API Endpoints:** 15+
- **Model Parameters:** ~100,000+ (neural network weights)

---

## 👤 Author

**Muhammad Tayyab Saeed**

Final Year Project - Medical EEG Diagnosis System

---

## 📄 License

This project is for educational purposes as part of final year coursework.

---

## 🎓 Academic Integrity

This project represents original work completed as part of the final year project requirement. All external libraries and frameworks are properly credited and used according to their licenses.

---

## 📞 Support

For questions or issues:

1. Check the documentation in individual component files
2. Review Flask API logs in terminal
3. Check browser console for frontend errors
4. Verify Supabase connection and environment variables

---

**Last Updated:** May 2026
