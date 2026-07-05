import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DocumentStorageAdapter } from "@driverslicense/domain";
import { extname } from "node:path";

export class S3DocumentStorageAdapter implements DocumentStorageAdapter {
  private readonly bucketName = requiredEnv("DOCUMENT_BUCKET_NAME");
  private readonly client = new S3Client({
    region: process.env.AWS_REGION ?? "us-east-2"
  });

  async save(input: {
    documentId: string;
    filename: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<{ storageKey: string }> {
    const storageKey = `uploads/${input.documentId}${extname(input.filename) || ".bin"}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
        Body: Buffer.from(input.bytes),
        ContentType: input.contentType,
        Metadata: {
          originalFilename: input.filename
        }
      })
    );

    return { storageKey };
  }

  async read(storageKey: string): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey
      })
    );

    if (!response.Body) {
      throw new Error(`S3 object ${storageKey} had no body.`);
    }

    return response.Body.transformToByteArray();
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for AWS adapter mode.`);
  }

  return value;
}
