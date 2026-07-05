import { Controller, Get, Inject } from "@nestjs/common";
import { DocumentsService } from "../documents/documents.service";

@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Get("summary")
  async summary() {
    return this.documentsService.dashboardSummary();
  }
}
