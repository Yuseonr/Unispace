import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../accounts/auth/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Controller('admin/audit-logs')
@Roles(UserRole.ADMIN)
export class AdminAuditLogsController {
  constructor(private readonly auditLogs: AuditLogService) {}

  @Get()
  list(@Query() query: ListAuditLogsDto) {
    return this.auditLogs.list(query);
  }
}
