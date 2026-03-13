import { Command } from "commander";
import * as mailApi from "../api/mail.js";
import { output, errorOutput } from "../output/format.js";

const sendCommand = new Command("send")
  .description("Send a mail (requires User OAuth with mail scope)")
  .requiredOption("--to <emails>", "Recipient email addresses (separate with ;)")
  .requiredOption("--subject <subject>", "Mail subject")
  .option("--body <body>", "Mail body content")
  .option("--cc <emails>", "CC email addresses (separate with ;)")
  .option("--bcc <emails>", "BCC email addresses (separate with ;)")
  .option("--content-type <type>", "Body format: html or text", "html")
  .option("--user <userId>", "Sender user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .option("--dry-run", "Print request without sending")
  .action(async (opts) => {
    try {
      const sendOpts: mailApi.SendMailOptions = {
        to: opts.to as string,
        subject: opts.subject as string,
        body: opts.body as string | undefined,
        cc: opts.cc as string | undefined,
        bcc: opts.bcc as string | undefined,
        contentType: opts.contentType as "html" | "text",
        userId: (opts.user as string | undefined) ?? "me",
        profile: opts.profile as string,
      };

      if (opts.dryRun) {
        output({ dryRun: true, request: sendOpts }, opts);
        return;
      }

      await mailApi.sendMail(sendOpts);
      output({ success: true, message: "Mail sent (async)" }, opts);
    } catch (err) {
      const error = err as Error & { code?: string };
      errorOutput({ code: error.code, message: error.message }, opts);
      process.exitCode = 1;
    }
  });

const listCommand = new Command("list")
  .description("List mails in a folder (requires User OAuth with mail or mail.read scope)")
  .option("--folder <folderId>", "Folder ID (default: 0 = inbox)", "0")
  .option("--count <n>", "Items per page (default: 30)", "30")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--unread", "Show unread mails only", false)
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await mailApi.listMails(
        parseInt(opts.folder as string, 10),
        (opts.user as string | undefined) ?? "me",
        parseInt(opts.count as string, 10),
        opts.cursor as string | undefined,
        opts.unread as boolean,
        opts.profile as string
      );

      const mails = result.mails.map((m) => ({
        mailId: m.mailId,
        from: m.from.email,
        subject: m.subject,
        date: m.receivedTime,
        status: m.status,
        attachments: m.attachCount ?? 0,
      }));

      output(
        {
          mails,
          count: mails.length,
          totalCount: result.totalCount,
          unreadCount: result.unreadCount,
          folderName: result.folderName,
          nextCursor: result.responseMetaData?.nextCursor ?? null,
        },
        opts
      );
    } catch (err) {
      const error = err as Error & { code?: string };
      errorOutput({ code: error.code, message: error.message }, opts);
      process.exitCode = 1;
    }
  });

const readCommand = new Command("read")
  .description("Read a specific mail (requires User OAuth with mail or mail.read scope)")
  .requiredOption("--id <mailId>", "Mail ID")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await mailApi.readMail(
        parseInt(opts.id as string, 10),
        (opts.user as string | undefined) ?? "me",
        opts.profile as string
      );

      const mail = result.mail;
      output(
        {
          mailId: mail.mailId,
          from: mail.from,
          to: mail.to,
          cc: mail.cc ?? [],
          subject: mail.subject,
          body: mail.body,
          date: mail.receivedTime,
          attachments: result.attachments?.map((a) => ({
            id: a.attachmentId,
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
          })) ?? [],
        },
        opts
      );
    } catch (err) {
      const error = err as Error & { code?: string };
      errorOutput({ code: error.code, message: error.message }, opts);
      process.exitCode = 1;
    }
  });

export const mailCommand = new Command("mail")
  .description("Mail operations (requires User OAuth with mail scope)")
  .addCommand(sendCommand)
  .addCommand(listCommand)
  .addCommand(readCommand);
