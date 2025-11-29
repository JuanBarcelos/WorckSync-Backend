import { z } from 'zod';
import { IOccurrenceRepository } from '../repositories/IOccurrenceRepository';
import { PrismaClient } from '@prisma/client';

const getStatsSchema = z.object({
  employeeId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  departmentId: z.string().optional(),
});

export type GetOccurrenceStatsDTO = z.infer<typeof getStatsSchema>;

export class GetOccurrenceStatsUseCase {
  constructor(
    private occurrenceRepository: IOccurrenceRepository,
    private prisma: PrismaClient
  ) {}

  async execute(filters: GetOccurrenceStatsDTO) {
    const validatedFilters = getStatsSchema.parse(filters);
    
    // Obter estatísticas básicas
    const stats = await this.occurrenceRepository.getStats(validatedFilters);

    // Obter top funcionários com mais ocorrências
    const topEmployees = await this.prisma.occurrence.groupBy({
      by: ['employeeId'],
      where: {
        ...(validatedFilters.startDate && validatedFilters.endDate && {
          date: {
            gte: validatedFilters.startDate,
            lte: validatedFilters.endDate,
          },
        }),
      },
      _count: true,
      orderBy: {
        _count: {
          employeeId: 'desc',
        },
      },
      take: 5,
    });

    // Buscar nomes dos funcionários
    const employeeIds = topEmployees.map(e => e.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
      },
      select: {
        id: true,
        name: true,
        department: true,
      },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // Calcular tendências (últimos 30 dias vs 30 dias anteriores)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [currentPeriod, previousPeriod] = await Promise.all([
      this.prisma.occurrence.count({
        where: {
          date: {
            gte: thirtyDaysAgo,
            lte: today,
          },
        },
      }),
      this.prisma.occurrence.count({
        where: {
          date: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo,
          },
        },
      }),
    ]);

    const trend = previousPeriod > 0 
      ? ((currentPeriod - previousPeriod) / previousPeriod * 100).toFixed(2)
      : '0';

    return {
      summary: {
        total: stats.total,
        pending: stats.pending,
        justified: stats.justified,
        approved: stats.approved,
        rejected: stats.rejected,
        pendingRate: stats.total > 0 
          ? ((stats.pending / stats.total) * 100).toFixed(2) + '%'
          : '0%',
        approvalRate: (stats.justified + stats.approved) > 0
          ? ((stats.approved / (stats.justified + stats.approved)) * 100).toFixed(2) + '%'
          : '0%',
      },
      byType: stats.byType.map(item => ({
        type: item.type,
        count: item.count,
        totalHours: (item.totalMinutes / 60).toFixed(2),
        percentage: stats.total > 0 
          ? ((item.count / stats.total) * 100).toFixed(2) + '%'
          : '0%',
      })),
      topEmployees: topEmployees.map(item => {
        const employee = employeeMap.get(item.employeeId);
        return {
          employeeId: item.employeeId,
          name: employee?.name || 'Desconhecido',
          department: employee?.department || 'N/A',
          occurrenceCount: item._count,
        };
      }),
      trend: {
        current: currentPeriod,
        previous: previousPeriod,
        change: trend,
        direction: currentPeriod > previousPeriod ? 'up' : currentPeriod < previousPeriod ? 'down' : 'stable',
      },
    };
  }
}