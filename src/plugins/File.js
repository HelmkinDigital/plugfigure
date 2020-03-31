import fs from 'fs';
import os from 'os';

export default async function file(filename, cb) {
  const fixedFilename = /^~\//.test(filename) ? `${os.homedir()}/${filename.substring(2)}` : filename;

  let lastcontents = await new Promise((resolve, reject) => {
    fs.readFile(fixedFilename, 'utf8', (err, data) => err ? reject(err) : resolve(data));
  });

  // (ben@helmkin.com) Be mindful of the GC when modifying how the watcher is
  // handled. This is an easy place to cause a memory leak.
  let watcher = fs.watch(fixedFilename, {
    persistent: false,
    recursive: false,
    encoding: 'utf8',
  });

  const changeHandler = async () => {
    watcher.close();
    watcher = fs.watch(fixedFilename, {
      persistent: false,
      recursive: false,
      encoding: 'utf8',
    });
    watcher.on('change', changeHandler);

    const newContents = await new Promise((resolve, reject) => {
      fs.readFile(fixedFilename, 'utf8', (err, data) => err ? reject(err) : resolve(data));
    });

    if (newContents === lastcontents) return;

    lastcontents = newContents;
    cb(newContents);
  };

  watcher.on('change', changeHandler);

  return {
    value: filecontents,
    cancel: () => watcher.close(),
  };
}

