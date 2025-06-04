import { Prisma } from '@prisma/client';
import { prisma } from '../db';

export class UserReputation {
  private static readonly MAX_FAILED_ORDERS = 3;
  private static readonly REPUTATION_RESET_PERIOD = 24 * 60 * 60 * 1000; // 24 horas
  private static readonly SUSPICIOUS_THRESHOLD = -5;
  private static readonly GOOD_THRESHOLD = 5;

  async canProceed(userId: string): Promise<boolean> {
    const reputation = await prisma.$queryRaw<{ score: number; updatedAt: Date }[]>`
      SELECT score, "updatedAt" FROM "UserReputation" WHERE "userId" = ${userId}
    `;

    if (!reputation.length) return true;

    const userRep = reputation[0];
    // Verificar si el usuario está suspendido
    if (userRep.score <= UserReputation.SUSPICIOUS_THRESHOLD) {
      const timeSinceLastAction = Date.now() - userRep.updatedAt.getTime();
      if (timeSinceLastAction < UserReputation.REPUTATION_RESET_PERIOD) {
        return false;
      }
    }

    return true;
  }

  async trackOrderExecution(userId: string, success: boolean): Promise<void> {
    const scoreChange = success ? 1 : -2; // Las fallidas penalizan más

    await prisma.$executeRaw`
      INSERT INTO "UserReputation" ("userId", score, "failedOrders", "lastFailedAt", "createdAt", "updatedAt")
      VALUES (${userId}, ${scoreChange}, ${success ? 0 : 1}, ${success ? null : new Date()}, NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE
      SET score = score + ${scoreChange},
          "failedOrders" = CASE WHEN ${success} THEN 0 ELSE "failedOrders" + 1 END,
          "lastFailedAt" = ${success ? null : new Date()},
          "updatedAt" = NOW()
    `;
  }

  async trackSuspiciousActivity(userId: string, activity: string): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO "UserReputation" ("userId", score, "suspiciousActivities", "lastFailedAt", "createdAt", "updatedAt")
      VALUES (${userId}, -3, ARRAY[${activity}], NOW(), NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE
      SET score = score - 3,
          "suspiciousActivities" = array_append("suspiciousActivities", ${activity}),
          "lastFailedAt" = NOW(),
          "updatedAt" = NOW()
    `;
  }

  async getReputation(userId: string): Promise<{
    score: number;
    status: 'GOOD' | 'NEUTRAL' | 'SUSPICIOUS';
    failedOrders: number;
    lastFailedAt: Date | null;
  }> {
    const reputation = await prisma.$queryRaw<{
      score: number;
      failedOrders: number;
      lastFailedAt: Date | null;
    }[]>`
      SELECT score, "failedOrders", "lastFailedAt"
      FROM "UserReputation"
      WHERE "userId" = ${userId}
    `;

    if (!reputation.length) {
      return {
        score: 0,
        status: 'NEUTRAL',
        failedOrders: 0,
        lastFailedAt: null
      };
    }

    const userRep = reputation[0];
    let status: 'GOOD' | 'NEUTRAL' | 'SUSPICIOUS' = 'NEUTRAL';
    if (userRep.score >= UserReputation.GOOD_THRESHOLD) {
      status = 'GOOD';
    } else if (userRep.score <= UserReputation.SUSPICIOUS_THRESHOLD) {
      status = 'SUSPICIOUS';
    }

    return {
      score: userRep.score,
      status,
      failedOrders: userRep.failedOrders,
      lastFailedAt: userRep.lastFailedAt
    };
  }
} 