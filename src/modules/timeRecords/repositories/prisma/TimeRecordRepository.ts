import { PrismaClient, TimeRecord } from "@prisma/client";
import { ITimeRecordRepository, UpdateTimeRecordDTO } from "../ITimeRecordRepository";

export class PrismaTimeRecordRepository implements ITimeRecordRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmployeeId(employeeId: string): Promise<TimeRecord[]> {
    return this.prisma.timeRecord.findMany({
      where: { employeeId },
      orderBy: { date: "asc" },
    });
  }

  async findById(id: string): Promise<TimeRecord | null> {
    return this.prisma.timeRecord.findUnique({
      where: { id },
    });
  }

  async updateTimeRecord(data: UpdateTimeRecordDTO): Promise<TimeRecord> {
    const { id, ...updateData } = data;
    
    return this.prisma.timeRecord.update({
      where: { id },
      data: updateData,
    });
  }
}