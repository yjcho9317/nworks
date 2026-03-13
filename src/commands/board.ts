import { Command } from "commander";
import * as boardApi from "../api/board.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

const listCommand = new Command("list")
  .description("List boards (requires User OAuth with board or board.read scope)")
  .option("--count <n>", "Items per page (default: 20)", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await boardApi.listBoards(
        parseInt(opts.count as string, 10),
        opts.cursor as string | undefined,
        opts.profile as string
      );

      const boards = result.boards.map((b) => ({
        boardId: b.boardId,
        boardName: b.boardName,
        description: b.description ?? "",
      }));

      output(
        { boards, count: boards.length, nextCursor: result.responseMetaData?.nextCursor ?? null },
        opts
      );
    } catch (err) {
      cliError(err, opts, "board");
    }
  });

const postsCommand = new Command("posts")
  .description("List posts in a board (requires User OAuth with board or board.read scope)")
  .requiredOption("--board <boardId>", "Board ID")
  .option("--count <n>", "Items per page (default: 20)", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await boardApi.listPosts(
        opts.board as string,
        parseInt(opts.count as string, 10),
        opts.cursor as string | undefined,
        opts.profile as string
      );

      const posts = result.posts.map((p) => ({
        postId: p.postId,
        title: p.title,
        userName: p.userName ?? "",
        readCount: p.readCount ?? 0,
        commentCount: p.commentCount ?? 0,
        createdTime: p.createdTime ?? "",
      }));

      output(
        { posts, count: posts.length, nextCursor: result.responseMetaData?.nextCursor ?? null },
        opts
      );
    } catch (err) {
      cliError(err, opts, "board");
    }
  });

const readCommand = new Command("read")
  .description("Read a post detail (requires User OAuth with board or board.read scope)")
  .requiredOption("--board <boardId>", "Board ID")
  .requiredOption("--post <postId>", "Post ID")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const post = await boardApi.readPost(
        opts.board as string,
        opts.post as string,
        opts.profile as string
      );

      output(
        {
          postId: post.postId,
          boardId: post.boardId,
          title: post.title,
          body: post.body ?? "",
          userName: post.userName ?? "",
          readCount: post.readCount ?? 0,
          commentCount: post.commentCount ?? 0,
          createdTime: post.createdTime ?? "",
          updatedTime: post.updatedTime ?? "",
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "board");
    }
  });

const createCommand = new Command("create")
  .description("Create a post in a board (requires User OAuth with board scope)")
  .requiredOption("--board <boardId>", "Board ID")
  .requiredOption("--title <title>", "Post title")
  .option("--body <text>", "Post body")
  .option("--no-comment", "Disable comments")
  .option("--notify", "Send notification")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const post = await boardApi.createPost({
        boardId: opts.board as string,
        title: opts.title as string,
        body: opts.body as string | undefined,
        enableComment: opts.comment as boolean,
        sendNotifications: (opts.notify as boolean | undefined) ?? false,
        profile: opts.profile as string,
      });

      output(
        {
          success: true,
          postId: post.postId,
          boardId: post.boardId,
          title: post.title,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "board");
    }
  });

export const boardCommand = new Command("board")
  .description("Board operations (requires User OAuth)")
  .addCommand(listCommand)
  .addCommand(postsCommand)
  .addCommand(readCommand)
  .addCommand(createCommand);
