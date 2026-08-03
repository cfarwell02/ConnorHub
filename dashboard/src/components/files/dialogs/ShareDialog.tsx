"use client";

import { Download, QrCode, Share2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";

type ShareDialogProps = {
  itemName: string;
  relativePath: string;
  isDirectory: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export default function ShareDialog({
  itemName,
  relativePath,
  isDirectory,
  isOpen,
  onClose,
}: ShareDialogProps) {
  const [isPreparing, setIsPreparing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const sharedName = isDirectory ? `${itemName}.zip` : itemName;

  const canUseNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  function getShareUrl(): string {
    return `/api/files/share?path=${encodeURIComponent(relativePath)}`;
  }

  function downloadBlob(blob: Blob) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = sharedName;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
  }
  async function handleDownload() {
    if (isPreparing) {
      return;
    }

    setIsPreparing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(getShareUrl());

      if (!response.ok) {
        const result = (await response.json()) as {
          error?: string;
        };

        throw new Error(result.error ?? "The item could not be prepared.");
      }

      const blob = await response.blob();
      downloadBlob(blob);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The item could not be downloaded.",
      );
    } finally {
      setIsPreparing(false);
    }
  }
  async function handleShowQrCode() {
    if (isPreparing) {
      return;
    }

    setIsPreparing(true);
    setErrorMessage(null);
    setQrCodeUrl(null);
    setQrExpiresAt(null);

    try {
      const response = await fetch("/api/share/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relativePath,
          lifetimeMinutes: 5,
        }),
      });

      const result = (await response.json()) as {
        shareUrl?: string;
        expiresAt?: string;
        error?: string;
      };

      if (!response.ok || !result.shareUrl) {
        throw new Error(
          result.error ?? "The temporary share could not be created.",
        );
      }
      setQrExpiresAt(result.expiresAt ?? null);

      const generatedQrCode = await QRCode.toDataURL(result.shareUrl, {
        width: 280,
        margin: 2,
      });

      setQrCodeUrl(generatedQrCode);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The QR code could not be generated.",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleNativeShare() {
    if (isPreparing) {
      return;
    }

    setIsPreparing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(getShareUrl());

      if (!response.ok) {
        const result = (await response.json()) as {
          error?: string;
        };

        throw new Error(result.error ?? "The item could not be prepared.");
      }

      const blob = await response.blob();

      const file = new File([blob], sharedName, {
        type: blob.type || "application/octet-stream",
      });

      const canShareFiles =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({
          files: [file],
        });

      if (!canShareFiles) {
        throw new Error("Native file sharing is not supported on this device.");
      }

      await navigator.share({
        title: sharedName,
        files: [file],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The item could not be shared.",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  function handleClose() {
    setQrCodeUrl(null);
    setQrExpiresAt(null);
    setErrorMessage(null);
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4"
      onMouseDown={(event) => {
        event.stopPropagation();

        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="share-dialog-title"
              className="truncate text-lg font-semibold text-zinc-100"
            >
              Share “{itemName}”
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {isDirectory
                ? "ConnorHub will prepare this folder as a ZIP file."
                : "Choose how you want to share this file."}
            </p>

            {!window.isSecureContext && (
              <p className="mt-2 text-xs text-amber-300">
                Native sharing requires ConnorHub to be opened over HTTPS.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close share dialog"
            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
          {canUseNativeShare && (
            <ShareAction
              icon={<Share2 size={18} />}
              title={isPreparing ? "Preparing…" : "Share"}
              description="Open the native share sheet."
              disabled={isPreparing}
              onClick={handleNativeShare}
            />
          )}

          <ShareAction
            icon={<Download size={18} />}
            title={isPreparing ? "Preparing…" : "Download"}
            description={`Download ${sharedName} to this device.`}
            disabled={isPreparing}
            onClick={handleDownload}
          />

          <ShareAction
            icon={<QrCode size={18} />}
            title="Show QR Code"
            description="Scan this code to download the item on another device."
            disabled={isPreparing}
            onClick={handleShowQrCode}
          />
          {qrCodeUrl && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-white p-4">
              <img
                src={qrCodeUrl}
                alt={`QR code for ${sharedName}`}
                className="mx-auto h-64 w-64 max-w-full"
              />

              <p className="mt-3 text-center text-xs text-zinc-600">
                Scan with your phone camera to download {sharedName}.
              </p>

              {qrExpiresAt && (
                <p className="mt-1 text-center text-xs text-zinc-500">
                  Expires at{" "}
                  {new Date(qrExpiresAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}
          {errorMessage && (
            <p className="px-1 pt-2 text-sm text-red-300">{errorMessage}</p>
          )}
        </div>

        <footer className="flex justify-end border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

type ShareActionProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
};

function ShareAction({
  icon,
  title,
  description,
  disabled = false,
  onClick,
}: ShareActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-200">{title}</span>

        <span className="mt-0.5 block text-xs text-zinc-500">
          {description}
        </span>
      </span>
    </button>
  );
}
