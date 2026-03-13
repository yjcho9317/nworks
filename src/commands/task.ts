import { Command } from "commander";
import * as taskApi from "../api/task.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

const listCommand = new Command("list")
  .description("List tasks (requires User OAuth with task or task.read scope)")
  .option("--category <categoryId>", "Category ID (default: default)", "default")
  .option("--status <status>", "Filter: TODO or ALL (default: ALL)", "ALL")
  .option("--count <n>", "Items per page (default: 50)", "50")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await taskApi.listTasks(
        opts.category as string,
        (opts.user as string | undefined) ?? "me",
        parseInt(opts.count as string, 10),
        opts.cursor as string | undefined,
        opts.status as "TODO" | "ALL",
        opts.profile as string
      );

      const tasks = result.tasks.map((t) => ({
        taskId: t.taskId,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate ?? "",
        assignor: t.assignorName ?? t.assignorId,
        created: t.createdTime,
      }));

      output(
        {
          tasks,
          count: tasks.length,
          nextCursor: result.responseMetaData?.nextCursor ?? null,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "task");
    }
  });

const createCommand = new Command("create")
  .description("Create a task (requires User OAuth with task scope)")
  .requiredOption("--title <title>", "Task title")
  .option("--body <content>", "Task content/description")
  .option("--due <date>", "Due date (YYYY-MM-DD)")
  .option("--category <categoryId>", "Category ID")
  .option("--assignee <userIds>", "Assignee user IDs (comma-separated)")
  .option("--user <userId>", "Creator user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const assigneeIds = opts.assignee
        ? (opts.assignee as string).split(",").map((s: string) => s.trim())
        : undefined;

      const result = await taskApi.createTask({
        title: opts.title as string,
        content: opts.body as string | undefined,
        dueDate: opts.due as string | undefined,
        categoryId: opts.category as string | undefined,
        assigneeIds,
        userId: (opts.user as string | undefined) ?? "me",
        profile: opts.profile as string,
      });

      output(
        {
          success: true,
          taskId: result.taskId,
          title: result.title,
          status: result.status,
          dueDate: result.dueDate,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "task");
    }
  });

const updateCommand = new Command("update")
  .description("Update a task (requires User OAuth with task scope)")
  .requiredOption("--id <taskId>", "Task ID")
  .option("--title <title>", "New title")
  .option("--body <content>", "New content")
  .option("--due <date>", "New due date (YYYY-MM-DD)")
  .option("--status <status>", "Set status: done or todo")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const profile = opts.profile as string;
      const taskId = opts.id as string;
      const status = opts.status as string | undefined;

      if (status) {
        if (status.toLowerCase() === "done") {
          await taskApi.completeTask(taskId, profile);
        } else if (status.toLowerCase() === "todo") {
          await taskApi.incompleteTask(taskId, profile);
        } else {
          throw new Error("Invalid status. Use 'done' or 'todo'.");
        }
      }

      const hasFieldUpdate = opts.title || opts.body || opts.due;
      if (hasFieldUpdate) {
        const result = await taskApi.updateTask({
          taskId,
          title: opts.title as string | undefined,
          content: opts.body as string | undefined,
          dueDate: opts.due as string | undefined,
          profile,
        });
        output(
          {
            success: true,
            taskId: result.taskId,
            title: result.title,
            status: result.status,
            dueDate: result.dueDate,
          },
          opts
        );
      } else if (status) {
        output(
          { success: true, taskId, status: status.toLowerCase() === "done" ? "DONE" : "TODO" },
          opts
        );
      } else {
        throw new Error("Specify at least one of: --title, --body, --due, --status");
      }
    } catch (err) {
      cliError(err, opts, "task");
    }
  });

const deleteCommand = new Command("delete")
  .description("Delete a task (requires User OAuth with task scope)")
  .requiredOption("--id <taskId>", "Task ID")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      await taskApi.deleteTask(
        opts.id as string,
        opts.profile as string
      );
      output({ success: true, taskId: opts.id, message: "Task deleted" }, opts);
    } catch (err) {
      cliError(err, opts, "task");
    }
  });

export const taskCommand = new Command("task")
  .description("Task operations (requires User OAuth with task scope)")
  .addCommand(listCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand);
