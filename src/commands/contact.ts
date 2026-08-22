import { Command } from "commander";
import * as contactApi from "../api/contact.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

const listCommand = new Command("list")
  .description("List contacts (requires User OAuth with contact or contact.read scope)")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--count <n>", "Items per page (default: 20)", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--tag <contactTagId>", "Filter by contact tag ID")
  .option("--email <email>", "Filter by email")
  .option("--tel <telephone>", "Filter by phone number")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await contactApi.listContacts({
        userId: (opts.user as string | undefined) ?? "me",
        count: parseInt(opts.count as string, 10),
        cursor: opts.cursor as string | undefined,
        contactTagId: opts.tag as string | undefined,
        email: opts.email as string | undefined,
        telephone: opts.tel as string | undefined,
        profile: opts.profile as string,
      });

      output(
        {
          contacts: result.contacts,
          count: result.contacts.length,
          nextCursor: result.responseMetaData?.nextCursor ?? null,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "contact");
    }
  });

const getCommand = new Command("get")
  .description("Get a contact by ID (requires User OAuth with contact or contact.read scope)")
  .requiredOption("--id <contactId>", "Contact ID (from contact list)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await contactApi.getContact(opts.id as string, opts.profile as string);
      output(result, opts);
    } catch (err) {
      cliError(err, opts, "contact");
    }
  });

const createCommand = new Command("create")
  .description("Create a contact (requires User OAuth with contact scope)")
  .requiredOption("--payload <json>", "Contact fields as JSON (passed through to the NAVER WORKS API)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .option("--dry-run", "Print request without creating")
  .action(async (opts) => {
    try {
      const payload = JSON.parse(opts.payload as string) as Record<string, unknown>;

      if (opts.dryRun) {
        output({ dryRun: true, request: payload }, opts);
        return;
      }

      const result = await contactApi.createContact(payload, opts.profile as string);
      output({ success: true, ...result }, opts);
    } catch (err) {
      cliError(err, opts, "contact");
    }
  });

const updateCommand = new Command("update")
  .description("Update a contact (requires User OAuth with contact scope)")
  .requiredOption("--id <contactId>", "Contact ID (from contact list)")
  .requiredOption("--payload <json>", "Fields to update as JSON (passed through to the NAVER WORKS API)")
  .option("--replace", "Use PUT instead of PATCH (replace entire contact)", false)
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const payload = JSON.parse(opts.payload as string) as Record<string, unknown>;
      const result = await contactApi.updateContact(
        opts.id as string,
        payload,
        !(opts.replace as boolean),
        opts.profile as string
      );
      output({ success: true, ...result }, opts);
    } catch (err) {
      cliError(err, opts, "contact");
    }
  });

const deleteCommand = new Command("delete")
  .description("Delete a contact (requires User OAuth with contact scope)")
  .requiredOption("--id <contactId>", "Contact ID (from contact list)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      await contactApi.deleteContact(opts.id as string, opts.profile as string);
      output({ success: true, contactId: opts.id, message: "Contact deleted" }, opts);
    } catch (err) {
      cliError(err, opts, "contact");
    }
  });

const listTagsCommand = new Command("list-tags")
  .description("List contact tags (requires User OAuth with contact or contact.read scope)")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--count <n>", "Items per page (default: 20)", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await contactApi.listContactTags({
        userId: (opts.user as string | undefined) ?? "me",
        count: parseInt(opts.count as string, 10),
        cursor: opts.cursor as string | undefined,
        profile: opts.profile as string,
      });

      output(
        {
          contactTags: result.contactTags,
          count: result.contactTags.length,
          nextCursor: result.responseMetaData?.nextCursor ?? null,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "contact");
    }
  });

export const contactCommand = new Command("contact")
  .description("Contact operations (requires User OAuth with contact scope)")
  .addCommand(listCommand)
  .addCommand(getCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand)
  .addCommand(listTagsCommand);
