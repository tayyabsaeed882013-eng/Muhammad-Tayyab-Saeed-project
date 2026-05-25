import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LOCAL_PATIENTS_KEY = "mds_local_patients";
const LOCAL_DIAGNOSES_KEY = "mds_local_diagnoses";

const isMissingTableError = (error: unknown) => {
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();
  return (
    message.includes("schema cache") ||
    message.includes("could not find the table 'public.")
  );
};

const readLocal = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
};

const writeLocal = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const nowIso = () => new Date().toISOString();
const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Database types
export interface Doctor {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female";
  phone: string;
  email: string;
  status: "undiagnosed" | "diagnosed";
  created_at: string;
  updated_at: string;
}

export interface Diagnosis {
  id: string;
  patient_id: string;
  file_name: string;
  file_url?: string;
  diagnosis_result?: string;
  confidence?: number;
  status: "processing" | "completed" | "failed";
  created_at: string;
  updated_at: string;
  patient?: Patient;
}

// Centralized real-time subscription manager
type SubscriptionCallback = (payload: any) => void;

interface SubscriptionManager {
  patients: Map<string, SubscriptionCallback>;
  diagnoses: Map<string, SubscriptionCallback>;
  patientsChannel: any | null;
  diagnosesChannel: any | null;
}

const subscriptionManager: SubscriptionManager = {
  patients: new Map(),
  diagnoses: new Map(),
  patientsChannel: null,
  diagnosesChannel: null,
};

// Initialize channels when first subscriber is added
const initializeChannels = () => {
  if (
    !subscriptionManager.patientsChannel &&
    subscriptionManager.patients.size > 0
  ) {
    subscriptionManager.patientsChannel = supabase
      .channel("patients-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients" },
        (payload) => {
          // Notify all subscribers
          subscriptionManager.patients.forEach((callback) => {
            try {
              callback(payload);
            } catch (error) {
              console.error("Error in patient subscription callback:", error);
            }
          });
        },
      )
      .subscribe();
  }

  if (
    !subscriptionManager.diagnosesChannel &&
    subscriptionManager.diagnoses.size > 0
  ) {
    subscriptionManager.diagnosesChannel = supabase
      .channel("diagnoses-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "diagnoses" },
        (payload) => {
          // Notify all subscribers
          subscriptionManager.diagnoses.forEach((callback) => {
            try {
              callback(payload);
            } catch (error) {
              console.error("Error in diagnosis subscription callback:", error);
            }
          });
        },
      )
      .subscribe();
  }
};

// Cleanup channels when no subscribers remain
const cleanupChannels = () => {
  if (
    subscriptionManager.patientsChannel &&
    subscriptionManager.patients.size === 0
  ) {
    subscriptionManager.patientsChannel.unsubscribe();
    subscriptionManager.patientsChannel = null;
  }

  if (
    subscriptionManager.diagnosesChannel &&
    subscriptionManager.diagnoses.size === 0
  ) {
    subscriptionManager.diagnosesChannel.unsubscribe();
    subscriptionManager.diagnosesChannel = null;
  }
};

// Auth helper functions
export const signUp = async (
  email: string,
  password: string,
  fullName: string,
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;

  // Create doctor profile
  if (data.user) {
    const { error: profileError } = await supabase.from("doctors").insert({
      id: data.user.id,
      email: data.user.email!,
      full_name: fullName,
    });

    if (profileError) throw profileError;
  }

  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

// Patient CRUD operations
export const getPatients = async () => {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch patients:", error);
    if (isMissingTableError(error)) {
      return readLocal<Patient>(LOCAL_PATIENTS_KEY);
    }
    return [];
  }
  return data;
};

export const createPatient = async (
  patient: Omit<Patient, "id" | "created_at" | "updated_at" | "status">,
) => {
  const { data, error } = await supabase
    .from("patients")
    .insert({ ...patient, status: "undiagnosed" })
    .select()
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      const localPatients = readLocal<Patient>(LOCAL_PATIENTS_KEY);
      const newPatient: Patient = {
        id: genId(),
        created_at: nowIso(),
        updated_at: nowIso(),
        status: "undiagnosed",
        ...patient,
      };
      localPatients.unshift(newPatient);
      writeLocal(LOCAL_PATIENTS_KEY, localPatients);
      return newPatient;
    }
    throw error;
  }
  return data;
};

export const updatePatient = async (id: string, updates: Partial<Patient>) => {
  const { data, error } = await supabase
    .from("patients")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      const localPatients = readLocal<Patient>(LOCAL_PATIENTS_KEY);
      const idx = localPatients.findIndex((p) => p.id === id);
      if (idx === -1) throw error;
      localPatients[idx] = {
        ...localPatients[idx],
        ...updates,
        updated_at: nowIso(),
      };
      writeLocal(LOCAL_PATIENTS_KEY, localPatients);
      return localPatients[idx];
    }
    throw error;
  }
  return data;
};

export const deletePatient = async (id: string) => {
  const { error } = await supabase.from("patients").delete().eq("id", id);

  if (error) {
    if (isMissingTableError(error)) {
      const localPatients = readLocal<Patient>(LOCAL_PATIENTS_KEY).filter(
        (p) => p.id !== id,
      );
      writeLocal(LOCAL_PATIENTS_KEY, localPatients);
      const localDiagnoses = readLocal<Diagnosis>(LOCAL_DIAGNOSES_KEY).filter(
        (d) => d.patient_id !== id,
      );
      writeLocal(LOCAL_DIAGNOSES_KEY, localDiagnoses);
      return;
    }
    throw error;
  }
};

// Diagnosis CRUD operations
export const getDiagnoses = async () => {
  const { data, error } = await supabase
    .from("diagnoses")
    .select(
      `
      *,
      patient:patients(*)
    `,
    )
    .order("created_at", { ascending: false });

  // Some databases may not have the foreign-key relation registered yet.
  // Fall back to diagnoses-only query so the page can still load.
  if (error) {
    console.error("Diagnoses join query failed, trying fallback:", error);
    const fallback = await supabase
      .from("diagnoses")
      .select("*")
      .order("created_at", { ascending: false });

    if (fallback.error) {
      // Keep UI functional even when policies/schema block this query.
      console.error("Diagnoses fallback query failed:", fallback.error);
      if (isMissingTableError(fallback.error)) {
        const localPatients = readLocal<Patient>(LOCAL_PATIENTS_KEY);
        const localDiagnoses = readLocal<Diagnosis>(LOCAL_DIAGNOSES_KEY);
        return localDiagnoses.map((d) => ({
          ...d,
          patient: localPatients.find((p) => p.id === d.patient_id),
        }));
      }
      return [];
    }
    return fallback.data;
  }
  return data;
};

export const createDiagnosis = async (
  diagnosis: Omit<Diagnosis, "id" | "created_at" | "updated_at">,
) => {
  console.log("Creating diagnosis with data:", diagnosis);
  const { data, error } = await supabase
    .from("diagnoses")
    .insert(diagnosis)
    .select()
    .single();

  if (error) {
    console.error("Supabase error creating diagnosis:", error);
    if (isMissingTableError(error)) {
      const localDiagnoses = readLocal<Diagnosis>(LOCAL_DIAGNOSES_KEY);
      const newDiagnosis: Diagnosis = {
        id: genId(),
        created_at: nowIso(),
        updated_at: nowIso(),
        ...diagnosis,
      };
      localDiagnoses.unshift(newDiagnosis);
      writeLocal(LOCAL_DIAGNOSES_KEY, localDiagnoses);

      const localPatients = readLocal<Patient>(LOCAL_PATIENTS_KEY);
      const patientIdx = localPatients.findIndex(
        (p) => p.id === diagnosis.patient_id,
      );
      if (patientIdx !== -1) {
        localPatients[patientIdx] = {
          ...localPatients[patientIdx],
          status: "diagnosed",
          updated_at: nowIso(),
        };
        writeLocal(LOCAL_PATIENTS_KEY, localPatients);
      }
      return newDiagnosis;
    }
    throw error;
  }

  console.log("Diagnosis created successfully:", data);
  return data;
};

export const updateDiagnosis = async (
  id: string,
  updates: Partial<Diagnosis>,
) => {
  const { data, error } = await supabase
    .from("diagnoses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteDiagnosis = async (id: string) => {
  try {
    const { error } = await supabase.from("diagnoses").delete().eq("id", id);

    if (error) {
      console.error("Delete error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(error.message || "Failed to delete diagnosis");
    }
  } catch (err) {
    console.error("Delete diagnosis error:", err);
    throw err;
  }
};

// File upload helper
export const uploadFile = async (
  file: File,
  bucket: string = "medical-files",
) => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return { path: data.path, url: publicUrl };
};

// Enhanced real-time subscriptions
export const subscribeToPatients = (
  callback: SubscriptionCallback,
): { unsubscribe: () => void } => {
  const id = Date.now().toString();
  subscriptionManager.patients.set(id, callback);
  initializeChannels();

  return {
    unsubscribe: () => {
      subscriptionManager.patients.delete(id);
      cleanupChannels();
    },
  };
};

export const subscribeToDiagnoses = (
  callback: SubscriptionCallback,
): { unsubscribe: () => void } => {
  const id = Date.now().toString();
  subscriptionManager.diagnoses.set(id, callback);
  initializeChannels();

  return {
    unsubscribe: () => {
      subscriptionManager.diagnoses.delete(id);
      cleanupChannels();
    },
  };
};
