import { Command } from "commander";
import * as messageApi from "../api/message.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

const sendCommand = new Command("send")
  .description("Send a message to a user or channel")
  .option("--to <userId>", "Recipient user ID")
  .option("--channel <channelId>", "Channel ID")
  .requiredOption("--text <text>", "Message text")
  .option("--type <type>", "Message type: text, button, list", "text")
  .option("--actions <json>", "Button actions JSON (type=button)")
  .option("--elements <json>", "List elements JSON (type=list)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .option("--dry-run", "Print request without sending")
  .action(async (opts) => {
    try {
      if (!opts.to && !opts.channel) {
        throw new Error("Either --to or --channel is required.");
      }

      const sendOpts: messageApi.SendOptions = {
        to: opts.to as string | undefined,
        channel: opts.channel as string | undefined,
        text: opts.text as string,
        type: opts.type as messageApi.MessageType,
        actions: opts.actions as string | undefined,
        elements: opts.elements as string | undefined,
        profile: opts.profile as string,
      };

      if (opts.dryRun) {
        output({ dryRun: true, request: sendOpts }, opts);
        return;
      }

      const result = await messageApi.send(sendOpts);
      output(result, opts);
    } catch (err) {
      cliError(err, opts);
    }
  });

const membersCommand = new Command("members")
  .description("List members of a channel")
  .requiredOption("--channel <channelId>", "Channel ID")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await messageApi.listMembers(
        opts.channel as string,
        opts.profile as string
      );
      output(result, opts);
    } catch (err) {
      cliError(err, opts);
    }
  });

export const messageCommand = new Command("message")
  .description("Bot message operations")
  .addCommand(sendCommand)
  .addCommand(membersCommand);
