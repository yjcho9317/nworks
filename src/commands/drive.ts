import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import * as driveApi from "../api/drive.js";
import { output } from "../output/format.js";
import { cliError } from "../output/cli-error.js";

const listCommand = new Command("list")
  .description("List files in Drive (requires User OAuth with file or file.read scope)")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--folder <folderId>", "Folder ID to list (default: root)")
  .option("--count <n>", "Items per page (default: 20)", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await driveApi.listFiles(
        (opts.user as string | undefined) ?? "me",
        opts.folder as string | undefined,
        parseInt(opts.count as string, 10),
        opts.cursor as string | undefined,
        opts.profile as string
      );

      const files = result.files.map((f) => ({
        name: f.fileName,
        type: f.fileType,
        size: f.fileSize,
        modified: f.modifiedTime,
        fileId: f.fileId,
      }));

      output(
        {
          files,
          count: files.length,
          nextCursor: result.responseMetaData?.nextCursor ?? null,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "drive");
    }
  });

const uploadCommand = new Command("upload")
  .description("Upload a file to Drive (requires User OAuth with file scope)")
  .requiredOption("--file <path>", "Local file path to upload")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--folder <folderId>", "Destination folder ID (default: root)")
  .option("--overwrite", "Overwrite if file exists", false)
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .option("--dry-run", "Print request without uploading")
  .action(async (opts) => {
    try {
      if (opts.dryRun) {
        output(
          {
            dryRun: true,
            request: {
              file: opts.file,
              user: opts.user ?? "me",
              folder: opts.folder ?? "(root)",
              overwrite: opts.overwrite,
            },
          },
          opts
        );
        return;
      }

      const result = await driveApi.uploadFile(
        opts.file as string,
        (opts.user as string | undefined) ?? "me",
        opts.folder as string | undefined,
        opts.overwrite as boolean,
        opts.profile as string
      );

      output(
        {
          success: true,
          fileId: result.fileId,
          fileName: result.fileName,
          fileSize: result.fileSize,
          filePath: result.filePath,
          fileType: result.fileType,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "drive");
    }
  });

const downloadCommand = new Command("download")
  .description("Download a file from Drive (requires User OAuth with file or file.read scope)")
  .requiredOption("--file-id <fileId>", "File ID to download")
  .option("--out <path>", "Output directory (default: current directory)")
  .option("--name <filename>", "Output filename (default: original name)")
  .option("--user <userId>", "Target user ID (default: me)")
  .option("--profile <name>", "Profile name", "default")
  .option("--json", "JSON output")
  .action(async (opts) => {
    try {
      const result = await driveApi.downloadFile(
        opts.fileId as string,
        (opts.user as string | undefined) ?? "me",
        opts.profile as string
      );

      const fileName =
        (opts.name as string | undefined) ?? result.fileName ?? opts.fileId as string;
      const outDir = (opts.out as string | undefined) ?? process.cwd();
      const outPath = join(outDir, fileName);

      await writeFile(outPath, result.buffer);

      output(
        {
          success: true,
          fileName,
          path: outPath,
          size: result.buffer.length,
        },
        opts
      );
    } catch (err) {
      cliError(err, opts, "drive");
    }
  });

export const driveCommand = new Command("drive")
  .description("Drive operations (requires User OAuth with file scope)")
  .addCommand(listCommand)
  .addCommand(uploadCommand)
  .addCommand(downloadCommand);
