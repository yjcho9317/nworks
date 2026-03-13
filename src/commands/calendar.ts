import { Command } from "commander";
import * as calendarApi from "../api/calendar.js";
import { output, errorOutput } from "../output/format.js";

function todayRange(): { from: string; until: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return {
    from: `${yyyy}-${mm}-${dd}T00:00:00+09:00`,
    until: `${yyyy}-${mm}-${dd}T23:59:59+09:00`,
  };
}

const listCommand = new Command("list")
  .description("List calendar events (requires User OAuth with calendar.read or calendar scope)")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--from <dateTime>", "Start (YYYY-MM-DDThh:mm:ss+09:00, default: today 00:00)")
  .option("--until <dateTime>", "End (YYYY-MM-DDThh:mm:ss+09:00, default: today 23:59)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const defaults = todayRange();
      const from = (opts.from as string | undefined) ?? defaults.from;
      const until = (opts.until as string | undefined) ?? defaults.until;
      const userId = (opts.user as string | undefined) ?? "me";

      const result = await calendarApi.listEvents(
        from,
        until,
        userId,
        opts.profile as string
      );

      const events = result.events.flatMap((e) =>
        e.eventComponents.map((c) => ({
          eventId: c.eventId,
          summary: c.summary,
          start: c.start.dateTime
            ? `${c.start.dateTime} (${c.start.timeZone ?? ""})`
            : c.start.date ?? "",
          end: c.end.dateTime
            ? `${c.end.dateTime} (${c.end.timeZone ?? ""})`
            : c.end.date ?? "",
          location: c.location ?? "",
        }))
      );

      output({ events, count: events.length }, opts);
    } catch (err) {
      const error = err as Error & { code?: string };
      errorOutput({ code: error.code, message: error.message }, opts);
      process.exitCode = 1;
    }
  });

const createCommand = new Command("create")
  .description("Create a calendar event (requires User OAuth with calendar scope)")
  .requiredOption("--title <title>", "Event title (summary)")
  .requiredOption("--start <dateTime>", "Start (YYYY-MM-DDThh:mm:ss)")
  .requiredOption("--end <dateTime>", "End (YYYY-MM-DDThh:mm:ss)")
  .option("--tz <timeZone>", "Time zone (default: Asia/Seoul)", "Asia/Seoul")
  .option("--description <text>", "Event description")
  .option("--location <place>", "Event location")
  .option("--attendees <emails>", "Attendee emails (comma-separated)")
  .option("--notify", "Send notification to attendees")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const attendees = opts.attendees
        ? (opts.attendees as string).split(",").map((e: string) => ({ email: e.trim() }))
        : undefined;

      const result = await calendarApi.createEvent({
        summary: opts.title as string,
        start: opts.start as string,
        end: opts.end as string,
        timeZone: opts.tz as string,
        description: opts.description as string | undefined,
        location: opts.location as string | undefined,
        attendees,
        sendNotification: (opts.notify as boolean | undefined) ?? false,
        userId: (opts.user as string | undefined) ?? "me",
        profile: opts.profile as string,
      });

      const event = result.eventComponents?.[0];
      const fmt = (t?: { dateTime?: string; timeZone?: string }) =>
        t?.dateTime ? `${t.dateTime} (${t.timeZone ?? ""})` : "";
      output(
        {
          success: true,
          eventId: event?.eventId,
          summary: event?.summary,
          start: fmt(event?.start),
          end: fmt(event?.end),
        },
        opts
      );
    } catch (err) {
      const error = err as Error & { code?: string };
      errorOutput({ code: error.code, message: error.message }, opts);
      process.exitCode = 1;
    }
  });

const updateCommand = new Command("update")
  .description("Update a calendar event (requires User OAuth with calendar scope)")
  .requiredOption("--id <eventId>", "Event ID")
  .option("--title <title>", "New title (summary)")
  .option("--start <dateTime>", "New start (YYYY-MM-DDThh:mm:ss)")
  .option("--end <dateTime>", "New end (YYYY-MM-DDThh:mm:ss)")
  .option("--tz <timeZone>", "Time zone (default: Asia/Seoul)", "Asia/Seoul")
  .option("--description <text>", "New description")
  .option("--location <place>", "New location")
  .option("--attendees <emails>", "Attendee emails (comma-separated)")
  .option("--notify", "Send notification to attendees")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const hasUpdate =
        opts.title || opts.start || opts.end || opts.description || opts.location || opts.attendees;
      if (!hasUpdate) {
        throw new Error("Specify at least one of: --title, --start, --end, --description, --location, --attendees");
      }

      const attendees = opts.attendees
        ? (opts.attendees as string).split(",").map((e: string) => ({ email: e.trim() }))
        : undefined;

      await calendarApi.updateEvent({
        eventId: opts.id as string,
        summary: opts.title as string | undefined,
        start: opts.start as string | undefined,
        end: opts.end as string | undefined,
        timeZone: opts.tz as string,
        description: opts.description as string | undefined,
        location: opts.location as string | undefined,
        attendees,
        sendNotification: (opts.notify as boolean | undefined) ?? false,
        userId: (opts.user as string | undefined) ?? "me",
        profile: opts.profile as string,
      });

      output(
        { success: true, eventId: opts.id, message: "Event updated" },
        opts
      );
    } catch (err) {
      const error = err as Error & { code?: string };
      errorOutput({ code: error.code, message: error.message }, opts);
      process.exitCode = 1;
    }
  });

const deleteCommand = new Command("delete")
  .description("Delete a calendar event (requires User OAuth with calendar scope)")
  .requiredOption("--id <eventId>", "Event ID")
  .option("--notify", "Send notification to attendees")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      await calendarApi.deleteEvent(
        opts.id as string,
        (opts.user as string | undefined) ?? "me",
        (opts.notify as boolean | undefined) ?? false,
        opts.profile as string
      );
      output({ success: true, eventId: opts.id, message: "Event deleted" }, opts);
    } catch (err) {
      const error = err as Error & { code?: string };
      errorOutput({ code: error.code, message: error.message }, opts);
      process.exitCode = 1;
    }
  });

export const calendarCommand = new Command("calendar")
  .description("Calendar operations (requires User OAuth)")
  .addCommand(listCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand);
