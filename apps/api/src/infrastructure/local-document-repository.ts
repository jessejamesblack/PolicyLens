import { DocumentRecord, DocumentRepository, parseDocumentRecord } from "@policylens/domain";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { dataDir } from "./local-paths";

export class LocalDocumentRepository implements DocumentRepository {
  private readonly filePath = join(dataDir(), "documents.json");

  async create(record: DocumentRecord): Promise<DocumentRecord> {
    const records = await this.readAll();
    records.push(record);
    await this.writeAll(records);
    return record;
  }

  async update(record: DocumentRecord): Promise<DocumentRecord> {
    const records = await this.readAll();
    const index = records.findIndex((existingRecord) => existingRecord.id === record.id);

    if (index === -1) {
      records.push(record);
    } else {
      records[index] = record;
    }

    await this.writeAll(records);
    return record;
  }

  async list(): Promise<DocumentRecord[]> {
    const records = await this.readAll();
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(documentId: string): Promise<DocumentRecord | null> {
    const records = await this.readAll();
    return records.find((record) => record.id === documentId) ?? null;
  }

  private async readAll(): Promise<DocumentRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown[];
      return parsed
        .map((record) => parseDocumentRecord(record))
        .filter((record): record is DocumentRecord => record !== null);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  private async writeAll(records: DocumentRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2));
  }
}
