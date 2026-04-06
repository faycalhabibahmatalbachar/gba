import { z } from 'zod';

export const pushFiltersSchema = z.object({
  role: z.string().optional(),
  country: z.string().optional(),
  platform: z.enum(['ios', 'android', 'all']).optional(),
  valid_only: z.coerce.boolean().optional(),
});
