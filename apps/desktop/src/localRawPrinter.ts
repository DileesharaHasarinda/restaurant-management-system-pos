import { app } from "electron";

import { execFile } from "node:child_process";

import { randomUUID } from "node:crypto";

import fs from "node:fs/promises";

import path from "node:path";

/*
|--------------------------------------------------------------------------
| Command Result
|--------------------------------------------------------------------------
*/

interface CommandResult {
  stdout: string;

  stderr: string;
}

/*
|--------------------------------------------------------------------------
| Run Local Command
|--------------------------------------------------------------------------
*/

const runCommand = async (
  executable: string,

  args: string[],

  environment: Record<string, string> = {}
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      {
        windowsHide: true,

        maxBuffer: 1024 * 1024,

        encoding: "utf8",

        env: {
          ...process.env,
          ...environment,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          const cleanStderr = typeof stderr === "string" ? stderr.trim() : "";

          reject(
            new Error(
              cleanStderr || error.message || "Local printer command failed."
            )
          );

          return;
        }

        resolve({
          stdout: typeof stdout === "string" ? stdout.trim() : "",

          stderr: typeof stderr === "string" ? stderr.trim() : "",
        });
      }
    );
  });

/*
|--------------------------------------------------------------------------
| Windows Printer Queue Test
|--------------------------------------------------------------------------
|
| This only checks whether the exact configured Windows printer queue exists.
|
| Example printer name:
|
| XP-80C
|--------------------------------------------------------------------------
*/

const WINDOWS_PRINTER_TEST_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"

$printerName = $env:POS_PRINTER_NAME

if ([string]::IsNullOrWhiteSpace($printerName)) {
    throw "Cashier receipt printer name is not configured."
}

$printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue

if ($null -eq $printer) {
    throw "Installed Windows printer queue was not found: $printerName"
}

Write-Output $printer.Name
`;

/*
|--------------------------------------------------------------------------
| Windows RAW ESC/POS Printing
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| There are deliberately NO PowerShell line-continuation backticks inside
| this TypeScript template string.
|
| RAW printing is required so these commands reach the thermal printer:
|
| - ESC/POS formatting
| - paper cut
| - cash drawer ESC p pulse
|--------------------------------------------------------------------------
*/

const WINDOWS_RAW_PRINT_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"

$printerName = $env:POS_PRINTER_NAME
$filePath = $env:POS_RAW_FILE

if ([string]::IsNullOrWhiteSpace($printerName)) {
    throw "Cashier receipt printer name is not configured."
}

if ([string]::IsNullOrWhiteSpace($filePath)) {
    throw "Temporary RAW print file is not configured."
}

if (-not (Test-Path -LiteralPath $filePath)) {
    throw "Temporary RAW print file does not exist."
}

$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RestaurantPosRawPrinter
{
    [StructLayout(
        LayoutKind.Sequential,
        CharSet = CharSet.Unicode
    )]
    public class DOC_INFO_1
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDatatype;
    }

    [DllImport(
        "winspool.drv",
        EntryPoint = "OpenPrinterW",
        SetLastError = true,
        CharSet = CharSet.Unicode
    )]
    private static extern bool OpenPrinter(
        string pPrinterName,
        out IntPtr phPrinter,
        IntPtr pDefault
    );

    [DllImport(
        "winspool.drv",
        EntryPoint = "ClosePrinter",
        SetLastError = true
    )]
    private static extern bool ClosePrinter(
        IntPtr hPrinter
    );

    [DllImport(
        "winspool.drv",
        EntryPoint = "StartDocPrinterW",
        SetLastError = true,
        CharSet = CharSet.Unicode
    )]
    private static extern int StartDocPrinter(
        IntPtr hPrinter,
        int level,
        [In] DOC_INFO_1 pDocInfo
    );

    [DllImport(
        "winspool.drv",
        EntryPoint = "EndDocPrinter",
        SetLastError = true
    )]
    private static extern bool EndDocPrinter(
        IntPtr hPrinter
    );

    [DllImport(
        "winspool.drv",
        EntryPoint = "StartPagePrinter",
        SetLastError = true
    )]
    private static extern bool StartPagePrinter(
        IntPtr hPrinter
    );

    [DllImport(
        "winspool.drv",
        EntryPoint = "EndPagePrinter",
        SetLastError = true
    )]
    private static extern bool EndPagePrinter(
        IntPtr hPrinter
    );

    [DllImport(
        "winspool.drv",
        EntryPoint = "WritePrinter",
        SetLastError = true
    )]
    private static extern bool WritePrinter(
        IntPtr hPrinter,
        IntPtr pBytes,
        int dwCount,
        out int dwWritten
    );

    private static void ThrowLastWindowsError(
        string operation
    )
    {
        throw new Win32Exception(
            Marshal.GetLastWin32Error(),
            operation
        );
    }

    public static int SendFile(
        string printerName,
        string filePath
    )
    {
        IntPtr printerHandle;

        if (
            !OpenPrinter(
                printerName,
                out printerHandle,
                IntPtr.Zero
            )
        )
        {
            ThrowLastWindowsError(
                "Unable to open printer '" + printerName + "'."
            );
        }

        try
        {
            DOC_INFO_1 documentInfo =
                new DOC_INFO_1
                {
                    pDocName =
                        "Restaurant POS RAW",

                    pOutputFile =
                        null,

                    pDatatype =
                        "RAW"
                };

            int jobId =
                StartDocPrinter(
                    printerHandle,
                    1,
                    documentInfo
                );

            if (
                jobId <= 0
            )
            {
                ThrowLastWindowsError(
                    "Unable to start RAW printer document."
                );
            }

            try
            {
                if (
                    !StartPagePrinter(
                        printerHandle
                    )
                )
                {
                    ThrowLastWindowsError(
                        "Unable to start RAW printer page."
                    );
                }

                try
                {
                    byte[] bytes =
                        System.IO.File.ReadAllBytes(
                            filePath
                        );

                    if (
                        bytes.Length == 0
                    )
                    {
                        return 0;
                    }

                    IntPtr unmanagedBytes =
                        Marshal.AllocCoTaskMem(
                            bytes.Length
                        );

                    try
                    {
                        Marshal.Copy(
                            bytes,
                            0,
                            unmanagedBytes,
                            bytes.Length
                        );

                        int written;

                        bool success =
                            WritePrinter(
                                printerHandle,
                                unmanagedBytes,
                                bytes.Length,
                                out written
                            );

                        if (
                            !success
                        )
                        {
                            ThrowLastWindowsError(
                                "Unable to write RAW ESC/POS bytes to printer."
                            );
                        }

                        if (
                            written
                            !=
                            bytes.Length
                        )
                        {
                            throw new InvalidOperationException(
                                "Printer accepted only "
                                + written
                                + " of "
                                + bytes.Length
                                + " RAW bytes."
                            );
                        }

                        return written;
                    }
                    finally
                    {
                        Marshal.FreeCoTaskMem(
                            unmanagedBytes
                        );
                    }
                }
                finally
                {
                    EndPagePrinter(
                        printerHandle
                    );
                }
            }
            finally
            {
                EndDocPrinter(
                    printerHandle
                );
            }
        }
        finally
        {
            ClosePrinter(
                printerHandle
            );
        }
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp

$written = [RestaurantPosRawPrinter]::SendFile(
    $printerName,
    $filePath
)

Write-Output $written
`;

/*
|--------------------------------------------------------------------------
| Validate Printer Name
|--------------------------------------------------------------------------
*/

const normalizePrinterName = (printerName: string): string => {
  const cleanName = printerName.trim();

  if (!cleanName) {
    throw new Error("Cashier receipt printer name is not configured.");
  }

  return cleanName;
};

/*
|--------------------------------------------------------------------------
| Windows Printer Test
|--------------------------------------------------------------------------
*/

const testWindowsPrinter = async (printerName: string): Promise<void> => {
  await runCommand(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      WINDOWS_PRINTER_TEST_SCRIPT,
    ],
    {
      POS_PRINTER_NAME: printerName,
    }
  );
};

/*
|--------------------------------------------------------------------------
| macOS / Linux Printer Test
|--------------------------------------------------------------------------
|
| This is useful for development on macOS.
|
| Production cashier printing is expected to use the Windows printer queue.
|--------------------------------------------------------------------------
*/

const testUnixPrinter = async (printerName: string): Promise<void> => {
  await runCommand("lpstat", ["-p", printerName]);
};

/*
|--------------------------------------------------------------------------
| Test Local Printer
|--------------------------------------------------------------------------
*/

export const testLocalRawPrinter = async (
  printerName: string
): Promise<void> => {
  const cleanPrinterName = normalizePrinterName(printerName);

  try {
    if (process.platform === "win32") {
      await testWindowsPrinter(cleanPrinterName);

      return;
    }

    if (process.platform === "darwin" || process.platform === "linux") {
      await testUnixPrinter(cleanPrinterName);

      return;
    }

    throw new Error(
      `Local cashier receipt printing is not supported on ${process.platform}.`
    );
  } catch (exception) {
    const message =
      exception instanceof Error
        ? exception.message
        : "Unknown local printer error.";

    throw new Error(
      `Cashier receipt printer "${cleanPrinterName}" is not available. ${message}`
    );
  }
};

/*
|--------------------------------------------------------------------------
| Temporary RAW File
|--------------------------------------------------------------------------
*/

const temporaryRawFilePath = (): string =>
  path.join(
    app.getPath("temp"),

    ["restaurant-pos-raw", process.pid, Date.now(), randomUUID()].join("-") +
      ".bin"
  );

/*
|--------------------------------------------------------------------------
| Windows RAW Send
|--------------------------------------------------------------------------
*/

const sendRawWindows = async (
  printerName: string,

  filePath: string
): Promise<void> => {
  await runCommand(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      WINDOWS_RAW_PRINT_SCRIPT,
    ],
    {
      POS_PRINTER_NAME: printerName,

      POS_RAW_FILE: filePath,
    }
  );
};

/*
|--------------------------------------------------------------------------
| macOS / Linux RAW Send
|--------------------------------------------------------------------------
*/

const sendRawUnix = async (
  printerName: string,

  filePath: string
): Promise<void> => {
  await runCommand("lp", ["-d", printerName, "-o", "raw", filePath]);
};

/*
|--------------------------------------------------------------------------
| Send RAW ESC/POS Bytes
|--------------------------------------------------------------------------
*/

export const sendRawToLocalPrinter = async (
  printerName: string,

  data: Buffer
): Promise<number> => {
  const cleanPrinterName = normalizePrinterName(printerName);

  /*
   * Check the configured OS printer queue before creating the job.
   */
  await testLocalRawPrinter(cleanPrinterName);

  const rawFile = temporaryRawFilePath();

  await fs.writeFile(rawFile, data);

  try {
    if (process.platform === "win32") {
      await sendRawWindows(cleanPrinterName, rawFile);
    } else if (process.platform === "darwin" || process.platform === "linux") {
      await sendRawUnix(cleanPrinterName, rawFile);
    } else {
      throw new Error(
        `Local cashier receipt printing is not supported on ${process.platform}.`
      );
    }

    return data.length;
  } catch (exception) {
    const message =
      exception instanceof Error
        ? exception.message
        : "Unknown RAW printer error.";

    throw new Error(
      `Unable to send RAW ESC/POS data to cashier printer "${cleanPrinterName}". ${message}`
    );
  } finally {
    try {
      await fs.unlink(rawFile);
    } catch {
      /*
       * Temporary file cleanup is best effort.
       */
    }
  }
};
