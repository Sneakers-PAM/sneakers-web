// Wait until a URL answers 200. Used to start a server from a build another webServer
// entry is still making.
const [url, seconds = "240"] = process.argv.slice(2);
const deadline = Date.now() + Number(seconds) * 1000;

const up = async () => {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
};

while (!(await up())) {
  if (Date.now() > deadline) throw new Error(`timed out waiting for ${url}`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
