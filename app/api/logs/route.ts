import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const skip = (page - 1) * pageSize;
    
    // Filter params
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const service = searchParams.get('service');
    const status = searchParams.get('status');
    const availability = searchParams.get('availability');

    const where: Prisma.HealthCheckWhereInput = {};

    if (startDate || endDate) {
      where.timestampUtc = {};
      if (startDate) {
        where.timestampUtc.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestampUtc.lte = new Date(endDate);
      }
    }

    if (service) {
      where.serviceName = service;
    }

    if (status) {
      const parsedStatus = parseInt(status, 10);
      if (!isNaN(parsedStatus)) {
        where.statusCode = parsedStatus;
      }
    }

    if (availability !== null) {
      where.isAvailable = availability === 'true';
    }

    // Fetch data and count in parallel
    const [total, data] = await Promise.all([
      prisma.healthCheck.count({ where }),
      prisma.healthCheck.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          timestampUtc: 'desc',
        },
      })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
