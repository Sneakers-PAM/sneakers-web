/** Saves text as a file through the browser's download, with no page navigation. */
export const downloadText = (text: string, fileName: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
