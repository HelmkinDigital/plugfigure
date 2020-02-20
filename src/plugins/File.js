import fs from 'fs';
import os from 'os';

export default async function file(filename, watcher) {
  const fixedFilename = /^~\//.test(filename) ? `${os.homedir()}/${filename.substring(2)}` : filename;

  const filecontents = await new Promise((resolve, reject) => {
    fs.readFile(fixedFilename, 'utf8', (err, data) => err ? reject(err) : resolve(data));
  });

  fs.watch(fixedFilename, {
    persistent: false,
    recursive: false,
    encoding: 'utf8',
  }, async (eventType) => {
    if (eventType !== 'change') return
    const value = await file(filename, watcher);
    watcher(value);
  });

  return filecontents;
}

