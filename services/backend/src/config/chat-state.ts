import { Response } from "express";

export const activeSessions = new Map<string, Response>();

export const pendingQuestions = new Map<string, { questionId: string }>();

export function setSession(userId: string, res: Response) {
    activeSessions.set(userId, res);
}

export function getSession(userId: string): Response | undefined {
    return activeSessions.get(userId);
}

export function removeSession(userId: string) {
    activeSessions.delete(userId);
}

export function setPending(userId: string, questionId: string) {
    pendingQuestions.set(userId, { questionId });
}

export function getPending(userId: string): { questionId: string } | undefined {
    return pendingQuestions.get(userId);
}

export function removePending(userId: string) {
    pendingQuestions.delete(userId);
}
