/** Saves text the box sent once (a private key, a certificate) as a file, without a server. */
export const saveText = (fileName: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
