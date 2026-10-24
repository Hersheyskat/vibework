import { z } from "zod";

export const feedbackSchema = z.object({
  verdict: z.string(),
  scores: z
    .array(
      z.object({
        skill: z.string(),
        score: z.number().min(1).max(5),
        evidence: z.string().optional().default(""),
      }),
    )
    .min(1),
  strengths: z.array(z.string()).optional().default([]),
  improve: z.array(z.string()).optional().default([]),
  tasks: z
    .array(
      z.object({
        task: z.string(),
        gap: z.string(),
      }),
    )
    .optional()
    .default([]),
  senior: z.string().optional().default(""),
  missed: z.array(z.string()).optional().default([]),
  drill: z.string().optional().default(""),
});

export type PracticeFeedback = z.infer<typeof feedbackSchema>;

export function feedbackTotal(f: PracticeFeedback): number {
  return f.scores.reduce(
    (a, s) => a + Math.max(0, Math.min(5, Number(s.score) || 0)),
    0,
  );
}
