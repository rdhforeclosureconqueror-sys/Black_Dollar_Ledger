import { z } from "zod";

export const EarnShareSchema = z.object({
  member_id: z.string().min(2),
  share_platform: z.enum(["facebook", "tiktok", "instagram", "x", "other"]).default("other"),
  share_url: z.string().url().optional(),
  // optional: attach screenshot link or post link
  proof_url: z.string().url().optional()
});

export const ReviewVideoSchema = z.object({
  member_id: z.string().min(2),
  business_name: z.string().min(2),
  business_address: z.string().min(5),
  service_type: z.string().min(2),
  what_makes_special: z.string().min(10),
  video_url: z.string().url(),
  // self-grade checklist (0/1 flags) – admin can override later
  checklist: z.object({
    clear_video_quality: z.boolean(),
    clear_location: z.boolean(),
    address_spoken_or_shown: z.boolean(),
    service_type_clear: z.boolean(),
    what_makes_special_clear: z.boolean()
  })
});

export const VoteSchema = z.object({
  member_id: z.string().min(2),
  contest_id: z.string().min(2),
  contestant_id: z.string().min(2),
  votes: z.number().int().min(1).max(50).default(1),
  // "free" uses monthly free vote; "stars" converts 3 stars per vote
  pay_with: z.enum(["free", "stars"]).default("stars")
});
