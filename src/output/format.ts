interface FormatOptions {
  json?: boolean;
}

export function output(data: unknown, opts: FormatOptions = {}): void {
  const useJson = opts.json || !process.stdout.isTTY;

  if (useJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (Array.isArray(data)) {
    printTable(data);
  } else if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && value.length > 0) {
        printTable(value);
        return;
      }
    }
    for (const [key, value] of Object.entries(record)) {
      console.log(`  ${key}: ${String(value)}`);
    }
  } else {
    console.log(String(data));
  }
}

function printTable(rows: unknown[]): void {
  if (rows.length === 0) {
    console.log("  (no data)");
    return;
  }

  const first = rows[0] as Record<string, unknown>;
  const keys = Object.keys(first);

  const widths: Record<string, number> = {};
  for (const key of keys) {
    widths[key] = key.length;
  }
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    for (const key of keys) {
      const len = String(record[key] ?? "").length;
      if (len > (widths[key] ?? 0)) {
        widths[key] = len;
      }
    }
  }

  const header = keys.map((k) => k.padEnd(widths[k] ?? 0)).join("  ");
  const separator = keys.map((k) => "─".repeat(widths[k] ?? 0)).join("──");

  console.log(`  ${header}`);
  console.log(`  ${separator}`);

  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const line = keys
      .map((k) => String(record[k] ?? "").padEnd(widths[k] ?? 0))
      .join("  ");
    console.log(`  ${line}`);
  }
}

export function errorOutput(
  error: { code?: string; message: string },
  opts: FormatOptions = {}
): void {
  const payload = {
    success: false,
    error: { code: error.code ?? "ERROR", message: error.message },
  };

  if (opts.json || !process.stderr.isTTY) {
    console.error(JSON.stringify(payload, null, 2));
  } else {
    console.error(`  Error: ${error.message}`);
    if (error.code) {
      console.error(`  Code: ${error.code}`);
    }
  }
}
