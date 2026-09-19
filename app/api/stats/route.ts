import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const totalHealthChecks = await prisma.healthCheck.count();
    
    const availableChecks = await prisma.healthCheck.count({
      where: { isAvailable: true }
    });
    
    const failedChecks = await prisma.healthCheck.count({
      where: { isAvailable: false }
    });
    
    const overallAvailabilityPercentage = totalHealthChecks > 0 
      ? Number(((availableChecks / totalHealthChecks) * 100).toFixed(2))
      : 0;
      
    const services = await prisma.healthCheck.groupBy({
      by: ['serviceName'],
    });

    const minMaxDates = await prisma.healthCheck.aggregate({
      _min: { timestampUtc: true },
      _max: { timestampUtc: true },
    });

    // We use queryRaw because Prisma doesn't support conditional aggregation in groupBy yet
    const perServiceStatsRaw = await prisma.$queryRaw`
      SELECT 
        "serviceName",
        COUNT(*) as "totalChecks",
        SUM(CASE WHEN "isAvailable" = true THEN 1 ELSE 0 END) as "availableChecks",
        SUM(CASE WHEN "isAvailable" = false THEN 1 ELSE 0 END) as "failedChecks"
      FROM "HealthCheck"
      GROUP BY "serviceName"
      ORDER BY "serviceName" ASC
    `;

    // Convert BigInts from raw query to numbers for JSON serialization
    const perServiceStats = (perServiceStatsRaw as any[]).map(stat => {
      const total = Number(stat.totalChecks);
      const available = Number(stat.availableChecks);
      const failed = Number(stat.failedChecks);
      
      return {
        serviceName: stat.serviceName,
        totalChecks: total,
        availableChecks: available,
        failedChecks: failed,
        availabilityPercentage: total > 0 ? Number(((available / total) * 100).toFixed(2)) : 0
      };
    });

    return NextResponse.json({
      totalHealthChecks,
      availableChecks,
      failedChecks,
      overallAvailabilityPercentage,
      servicesMonitored: services.length,
      monitoringStart: minMaxDates._min.timestampUtc,
      monitoringEnd: minMaxDates._max.timestampUtc,
      perServiceStats
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
