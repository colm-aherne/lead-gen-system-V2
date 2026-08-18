import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { dispatchCollectionWorkflow, leadStatuses, listDashboardLeads, markLeadContacted, markLeadDeclined, markLeadMeetingBooked, markLeadOptedOut, scanLeadChatbot } from "./leadData";

const leadStatusSchema = z.enum(leadStatuses);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  leads: router({
    list: adminProcedure
      .input(z.object({ search: z.string().max(80).optional(), status: leadStatusSchema.optional(), onlyUnused: z.boolean().optional(), noChatbotOnly: z.boolean().optional() }))
      .query(({ input }) => listDashboardLeads(input)),
    scanChatbot: adminProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .mutation(({ input }) => scanLeadChatbot(input.leadId)),
    getMore: adminProcedure
      .mutation(() => dispatchCollectionWorkflow()),
    optOut: adminProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .mutation(({ input }) => markLeadOptedOut(input.leadId)),
    markContacted: adminProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .mutation(({ input }) => markLeadContacted(input.leadId)),
    decline: adminProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .mutation(({ input }) => markLeadDeclined(input.leadId)),
    meetingBooked: adminProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .mutation(({ input }) => markLeadMeetingBooked(input.leadId)),
  }),
});

export type AppRouter = typeof appRouter;
