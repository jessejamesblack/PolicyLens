import type { DashboardSummary, DocumentRecord, DocumentType } from "@driverslicense/domain";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");

export interface UploadResponse {
  documentId: string;
  filename: string;
  status: "UPLOADED";
}

export async function uploadDocument(file: File, documentType: DocumentType): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  return request<UploadResponse>("/documents/upload", {
    method: "POST",
    body: formData
  });
}

export async function processDocument(documentId: string) {
  return request(`/documents/${documentId}/process`, {
    method: "POST"
  });
}

export async function getDocument(documentId: string): Promise<DocumentRecord> {
  return request<DocumentRecord>(`/documents/${documentId}`);
}

export async function getDocuments(): Promise<DocumentRecord[]> {
  return request<DocumentRecord[]>("/documents");
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/dashboard/summary");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
