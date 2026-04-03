import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { AppMonitorService } from './alerts/app-monitor.service';
import { SecurityMonitorService } from './alerts/security-monitor.service';
import { DiscordAlertService } from '../queues/alerts/discord-alert.service';

@Module({
  imports: [MetricsModule],
  providers: [DiscordAlertService, AppMonitorService, SecurityMonitorService],
  exports: [SecurityMonitorService, MetricsModule],
})
export class ObservabilityModule {}
