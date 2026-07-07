import type {
  DashboardFilters,
  DashboardSummary,
  DocumentRecord,
  DocumentType,
  LicenseFieldName
} from "@driverslicense/domain";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
const DIRECT_UPLOAD_THRESHOLD_BYTES = 8 * 1024 * 1024;

export interface UploadResponse {
  documentId: string;
  filename: string;
  status: "UPLOADED";
}

interface DirectUploadResponse {
  documentId: string;
  storageKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}

export async function uploadDocument(file: File, documentType: DocumentType): Promise<UploadResponse> {
  if (file.size >= DIRECT_UPLOAD_THRESHOLD_BYTES) {
    return uploadDocumentDirect(file, documentType);
  }

  return uploadDocumentMultipart(file, documentType);
}

async function uploadDocumentMultipart(file: File, documentType: DocumentType): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  return request<UploadResponse>("/documents/upload", {
    method: "POST",
    body: formData
  });
}

async function uploadDocumentDirect(file: File, documentType: DocumentType): Promise<UploadResponse> {
  const prepared = await request<DirectUploadResponse>("/documents/direct-upload", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      filename: file.name,
      documentType,
      contentType: file.type || "application/octet-stream",
      contentLength: file.size
    })
  });

  const upload = await fetch(prepared.uploadUrl, {
    method: prepared.method,
    headers: prepared.headers,
    body: file
  });

  if (!upload.ok) {
    const message = await upload.text();
    throw new Error(message || `S3 upload failed with ${upload.status}`);
  }

  return {
    documentId: prepared.documentId,
    filename: file.name,
    status: "UPLOADED"
  };
}

export async function processDocument(documentId: string) {
  return request(`/documents/${documentId}/process`, {
    method: "POST"
  });
}

export async function adjudicateDocument(input: {
  documentId: string;
  field: LicenseFieldName;
  value: unknown;
  note?: string;
}): Promise<DocumentRecord> {
  return request<DocumentRecord>(`/documents/${input.documentId}/adjudicate`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      field: input.field,
      value: input.value,
      note: input.note ?? null
    })
  });
}

export async function getDocument(documentId: string): Promise<DocumentRecord> {
  return request<DocumentRecord>(`/documents/${documentId}`);
}

export async function getDocuments(): Promise<DocumentRecord[]> {
  return request<DocumentRecord[]>("/documents");
}

export async function getDashboardSummary(filters: DashboardFilters = {}): Promise<DashboardSummary> {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, String(value));
    }
  }

  const queryString = search.toString();
  return request<DashboardSummary>(`/dashboard/summary${queryString ? `?${queryString}` : ""}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
