import { Button, cn, Textarea } from "@sneakers-web/ui";
import { Check, FileKey, X } from "lucide-react";
import { useId, useState } from "react";

import { appKeyProblem, parseAppKey } from "@/features/editors/githubAppKey";

/**
 * A GitHub App's private key: the .pem file dropped or chosen, or pasted as a fallback. The key
 * is checked as it comes in and never shown back; only its kind and size are.
 */
export const AppKeyInput = ({
  editing,
  error,
  label = "Private key",
  onChange,
  value,
}: {
  /** The secret already has a key, which a blank value keeps. */
  editing: boolean;
  /** A problem from the form; the key's own check shows without one. */
  error?: string;
  label?: string;
  onChange: (value: string) => void;
  value: string;
}) => {
  const input = useId();
  const [pasting, setPasting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [unreadable, setUnreadable] = useState(false);
  const key = value.trim() ? parseAppKey(value) : null;
  const problem = unreadable
    ? "That file couldn't be read. Choose it again."
    : (error ?? appKeyProblem(value) ?? undefined);

  const take = (file: File | undefined) => {
    if (!file) return;
    setUnreadable(false);
    file
      .text()
      .then((text) => {
        setFileName(file.name);
        setPasting(false);
        onChange(text);
      })
      .catch(() => setUnreadable(true));
  };
  const clear = () => {
    setFileName("");
    setUnreadable(false);
    onChange("");
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline gap-2 text-[0.875rem] font-bold" id={`${input}-label`}>
        {label}
        {!editing && (
          <span aria-hidden className="text-danger">
            *
          </span>
        )}
        <button
          className="ml-auto text-small font-bold text-primary hover:text-ink"
          onClick={() => {
            setPasting(!pasting);
            if (key) clear();
          }}
          type="button"
        >
          {pasting ? "Upload the file instead" : "Paste the key instead"}
        </button>
      </span>
      {pasting ? (
        <Textarea
          aria-describedby={problem ? `${input}-problem` : undefined}
          aria-invalid={!!problem}
          aria-labelledby={`${input}-label`}
          autoComplete="off"
          mono
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            editing
              ? "Leave empty to keep the stored key"
              : "Paste the whole .pem, BEGIN and END lines included"
          }
          rows={5}
          spellCheck={false}
          value={value}
        />
      ) : key?.ok ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border-[1.5px] border-ok bg-ok-soft px-4 py-3">
          <Check aria-hidden className="size-5 shrink-0 text-ok" strokeWidth={3} />
          <div className="flex min-w-0 flex-1 flex-col">
            <b>RSA {key.bits}-bit private key</b>
            <span className="truncate text-small text-muted">
              {fileName || "Pasted"} · stored encrypted, never shown again
            </span>
          </div>
          <Button onClick={clear} size="sm" variant="secondary">
            <X aria-hidden />
            Remove
          </Button>
        </div>
      ) : (
        <label
          aria-labelledby={`${input}-label`}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-control bg-sunken px-6 py-7 text-center",
            problem && "border-danger bg-danger-soft",
          )}
          htmlFor={input}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            take(event.dataTransfer.files[0]);
          }}
        >
          <FileKey aria-hidden className="size-6 text-muted" />
          <b>Drop the App&apos;s .pem file, or choose it</b>
          <span className="text-small text-muted">
            {fileName
              ? `${fileName} wasn't used.`
              : editing
                ? "The stored key stays unless you add a new one."
                : "On GitHub: the App's settings, Private keys, Generate a private key."}
          </span>
          <input
            accept=".pem,application/x-pem-file"
            className="sr-only"
            id={input}
            onChange={(event) => {
              take(event.target.files?.[0]);
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      )}
      {problem && (
        <span className="text-small font-bold text-danger" id={`${input}-problem`} role="alert">
          {problem}
        </span>
      )}
    </div>
  );
};
