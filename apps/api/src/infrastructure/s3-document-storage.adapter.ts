import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DirectUploadDocumentStorageAdapter } from "@driverslicense/domain";
import { extname } from "node:path";

const DIRECT_UPLOAD_EXPIRATION_SECONDS = 15 * 60;

export class S3DocumentStorageAdapter implements DirectUploadDocumentStorageAdapter {
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
    const storageKey = storageKeyFor(input.documentId, input.filename);

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

  async prepareDirectUpload(input: {
    documentId: string;
    filename: string;
    contentType: string;
    contentLength: number;
  }) {
    const storageKey = storageKeyFor(input.documentId, input.filename);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: input.contentType
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: DIRECT_UPLOAD_EXPIRATION_SECONDS
    });

    return {
      storageKey,
      uploadUrl,
      method: "PUT" as const,
      headers: {
        "content-type": input.contentType
      },
      expiresAt: new Date(Date.now() + DIRECT_UPLOAD_EXPIRATION_SECONDS * 1000).toISOString()
    };
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

function storageKeyFor(documentId: string, filename: string): string {
  return `uploads/${documentId}${extname(filename) || ".bin"}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for AWS adapter mode.`);
  }

  return value;
}
