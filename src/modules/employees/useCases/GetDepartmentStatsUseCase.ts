import { IEmployeeRepository } from '../repositories/IEmployeeRepository';

export class GetDepartmentStatsUseCase {
  constructor(private employeeRepository: IEmployeeRepository) {}

  async execute() {
    const stats = await this.employeeRepository.countByDepartment();
    
    const total = stats.reduce((acc, curr) => acc + curr.count, 0);

    return {
      total,
      departments: stats.map(stat => ({
        name: stat.department,
        count: stat.count,
        percentage: ((stat.count / total) * 100).toFixed(2),
      })),
    };
  }
}