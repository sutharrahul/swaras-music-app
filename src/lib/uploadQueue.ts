// In-memory job queue for background uploads
export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface FileResult {
  success: boolean;
  fileName: string;
  song?: any;
  error?: string;
}

export interface UploadJob {
  id: string;
  status: JobStatus;
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  results: FileResult[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

class UploadQueue {
  private jobs: Map<string, UploadJob> = new Map();

  createJob(id: string, totalFiles: number): UploadJob {
    const job: UploadJob = {
      id,
      status: JobStatus.PENDING,
      totalFiles,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      results: [],
      startedAt: new Date(),
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(id: string): UploadJob | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, updates: Partial<UploadJob>): void {
    const job = this.jobs.get(id);
    if (job) {
      Object.assign(job, updates);
    }
  }

  addResult(id: string, result: FileResult): void {
    const job = this.jobs.get(id);
    if (job) {
      job.results.push(result);
      job.processedFiles++;
      if (result.success) {
        job.successfulFiles++;
      } else {
        job.failedFiles++;
      }
    }
  }

  markProcessing(id: string): void {
    this.updateJob(id, { status: JobStatus.PROCESSING });
  }

  markCompleted(id: string): void {
    this.updateJob(id, {
      status: JobStatus.COMPLETED,
      completedAt: new Date(),
    });
  }

  markFailed(id: string, error: string): void {
    this.updateJob(id, {
      status: JobStatus.FAILED,
      completedAt: new Date(),
      error,
    });
  }

  deleteJob(id: string): void {
    this.jobs.delete(id);
  }
}

// Singleton instance
export const uploadQueue = new UploadQueue();
