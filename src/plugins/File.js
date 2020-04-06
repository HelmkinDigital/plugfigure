import fs from 'fs';
import os from 'os';
import YAML from 'yaml';

export async function file([ filename ], cb) {
  const fixedFilename = /^~\//.test(filename) ? `${os.homedir()}/${filename.substring(2)}` : filename;

  let lastContents = await new Promise((resolve, reject) => {
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

    if (newContents === lastContents) return;

    lastContents = newContents;
    cb(newContents);
  };

  watcher.on('change', changeHandler);

  return {
    value: lastContents,
    cancel: () => watcher.close(),
  };
}

export async function yaml_file(args, cb) {
  const { cancel, value } = await file(args, (newContents) => {
    const parsedNew = YAML.parse(newContents);
    cb(parsedNew);
  });

  const parsedValue = YAML.parse(value);
  return {
    value: parsedValue,
    cancel,
  }
}

export async function json_file(args, cb) {
  const { cancel, value } = await file(args, (newContents) => {
    const parsedNew = JSON.parse(newContents);
    cb(parsedNew);
  });

  const parsedValue = JSON.parse(value);
  return {
    value: parsedValue,
    cancel,
  }
}
