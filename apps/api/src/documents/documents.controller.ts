import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req
} from "@nestjs/common";
import {
  DOCUMENT_TYPES,
  documentTypeSchema,
  licenseFieldNameSchema,
  prepareDirectUploadSchema
} from "@driverslicense/domain";
import { DocumentsService } from "./documents.service";

type MultipartFilePart = {
  type: "file";
  fieldname: string;
  filename?: string;
  mimetype?: string;
  toBuffer: () => Promise<Buffer>;
};

type MultipartFieldPart = {
  type: "field";
  fieldname: string;
  value: unknown;
};

type MultipartRequest = {
  parts?: () => AsyncIterable<MultipartFilePart | MultipartFieldPart>;
};

@Controller("documents")
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Post("direct-upload")
  async prepareDirectUpload(
    @Body()
    body: {
      filename?: unknown;
      documentType?: unknown;
      contentType?: unknown;
      contentLength?: unknown;
    }
  ) {
    const parsed = prepareDirectUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("filename, documentType, contentType, and contentLength are required.");
    }

    return this.documentsService.prepareDirectUpload(parsed.data);
  }

  @Post("upload")
  async upload(@Req() request: MultipartRequest) {
    if (!request.parts) {
      throw new BadRequestException("Multipart uploads are not available.");
    }

    let file:
      | {
          filename: string;
          contentType: string;
          bytes: Buffer;
        }
      | null = null;
    let documentTypeRaw = "";

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "documentType") {
        documentTypeRaw = String(part.value ?? "");
      }

      if (part.type === "file" && part.fieldname === "file") {
        file = {
          filename: part.filename || "upload.bin",
          contentType: part.mimetype || "application/octet-stream",
          bytes: await part.toBuffer()
        };
      }
    }

    if (!file) {
      throw new BadRequestException("A document file is required.");
    }

    const parsedDocumentType = documentTypeSchema.safeParse(documentTypeRaw);
    if (!parsedDocumentType.success) {
      throw new BadRequestException(`documentType must be one of: ${DOCUMENT_TYPES.join(", ")}`);
    }

    const record = await this.documentsService.upload({
      filename: file.filename,
      contentType: file.contentType,
      documentType: parsedDocumentType.data,
      bytes: file.bytes
    });

    return {
      documentId: record.id,
      filename: record.filename,
      status: record.status
    };
  }

  @Post(":id/process")
  async process(@Param("id") documentId: string) {
    const record = await this.documentsService.process(documentId);

    return {
      documentId: record.id,
      status: record.status,
      validationStatus: record.validationStatus,
      extraction: record.extraction,
      rawOcr: record.rawOcr,
      rawExtraction: record.rawExtraction,
      errorMessage: record.errorMessage
    };
  }

  @Post(":id/adjudicate")
  async adjudicate(
    @Param("id") documentId: string,
    @Body() body: { field?: unknown; value?: unknown; note?: unknown }
  ) {
    const parsedField = licenseFieldNameSchema.safeParse(body.field);
    if (!parsedField.success) {
      throw new BadRequestException("field must be a supported license field.");
    }

    return this.documentsService.adjudicate({
      documentId,
      field: parsedField.data,
      value: body.value ?? null,
      note: typeof body.note === "string" ? body.note : null
    });
  }

  @Get()
  async list() {
    return this.documentsService.list();
  }

  @Get(":id")
  async get(@Param("id") documentId: string) {
    return this.documentsService.get(documentId);
  }
}
