import YAML from 'yaml';
import { file } from './plugins';

import ConfigTree from './ConfigTree';

// We may want to pull this from somewhere. Not sure yet.
const maxRecursion = 25;

export default class Plugfigure {
  constructor(plugins = {}) {
    if (typeof plugins !== 'object') throw new TypeError('Plugins must be an object');
    Object.entries(plugins).forEach(([name, plugin]) => {
      if (typeof plugin !== 'function') {
        throw new TypeError(`Plugin ${name} is not a function`);
      }
    });

    this.plugins = plugins;
  }

  setPlugin(name, handler) {
    if (typeof name !== 'string') throw new TypeError('Plugin name must be a string');
    if (typeof handler !== 'function') throw new TypeError('Plugin must be a function');
    this.plugins[name] = handler;
  }

  async load(value) {
    this.tree = new ConfigTree(value, undefined, this);
  }

  async getPluginValue(query, watcher) {
    if (typeof query !== 'string' || query[0] !== '@') return query;

    const [ pluginRawName, ...args ] = query.split(' ');
    const pluginName = pluginRawName.substring(1);

    const plugin = this.plugins[pluginName];
    return plugin(...args, watcher);
  }

  key(key) {
    if (!this.tree) throw new Error('Cannot retrieve node from unloaded instance');

    return this.tree.key(key);
  }
}

