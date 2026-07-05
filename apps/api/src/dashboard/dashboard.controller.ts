import { Controller, Get, Inject, Query } from "@nestjs/common";
import { DashboardFilters, documentTypeSchema, validationStatusSchema } from "@driverslicense/domain";
import { DocumentsService } from "../documents/documents.service";

@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Get("summary")
  async summary(
    @Query("issuingState") issuingState?: string,
    @Query("documentType") documentType?: string,
    @Query("validationStatus") validationStatus?: string,
    @Query("expirationBucket") expirationBucket?: string
  ) {
    const filters: DashboardFilters = {
      issuingState: issuingState || null,
      documentType: documentTypeSchema.safeParse(documentType).success
        ? documentTypeSchema.parse(documentType)
        : null,
      validationStatus: validationStatusSchema.safeParse(validationStatus).success
        ? validationStatusSchema.parse(validationStatus)
        : null,
      expirationBucket: expirationBucket || null
    };

    return this.documentsService.dashboardSummary(filters);
  }
}
