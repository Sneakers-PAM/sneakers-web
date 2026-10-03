/** A file's bytes as base64, without the data: URL prefix the reader adds. */
export const readBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("unreadable")));
    reader.readAsDataURL(file);
  });
