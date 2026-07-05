import { DocumentStorageAdapter } from "@driverslicense/domain";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { dataDir } from "./local-paths";

export class LocalDocumentStorageAdapter implements DocumentStorageAdapter {
  private readonly uploadDir = join(dataDir(), "uploads");

  async save(input: {
    documentId: string;
    filename: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<{ storageKey: string }> {
    await mkdir(this.uploadDir, { recursive: true });
    const extension = extname(input.filename) || ".bin";
    const storageKey = `${input.documentId}${extension}`;
    await writeFile(join(this.uploadDir, storageKey), Buffer.from(input.bytes));
    return { storageKey };
  }

  async read(storageKey: string): Promise<Uint8Array> {
    return readFile(join(this.uploadDir, storageKey));
  }
}

