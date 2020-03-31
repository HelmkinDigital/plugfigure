import eventemitter from 'events';
import { isDeepStrictEqual } from 'util';

const noCache = Symbol('No Cache'); // Use symbol so we can cache null and undefined

export default class ConfigTree extends EventEmitter {
  constructor(parent, key, plugfigure) {
    this.parent = parent;
    this.parent.on('change', () => {
      const oldRaw = this.cachedRaw;
      const newRaw = this.getRawValue(true);
      if (isDeepStrictEqual(oldRaw, newRaw)) return;
      this.getValue(true, true);
    });
    this.key = key;
    this.plugfigure = plugfigure;
    this.cachedValue = noCache;
    this.cachedRaw = noCache;
    this.children = Map();
    this.cancelLastWatcher = () => {};

    this.reloadValue();
  }

  async getRawValue(skipCache) {
    if (this.cachedRaw !== noCache && !skipCache) {
      return this.cachedRaw;
    }

    const parentValue = await this.parent.getValue();
    if (!parentValue) return undefined;

    return parentValue[this.key];
  }

  async getValue(forceReevaluation, isDependent) {
    if (this.cachedValue !== noCache && !forceReevaluation) {
      return this.cachedValue;
    }

    const localValue = this.getRawValue();

    if (typeof localValue === 'string' && localValue.startsWith('@')) {
      this.cancelLastWatcher();

      const {
        value: realValue,
        cancel,
      } = await this.plugfigure.getPluginValue(localValue, (newValue) => {
        if (isDeepStrictEqual(this.cachedValue, newValue)) return;
        this.cachedValue = newValue;
        this.emit('change');
        this.emit('independentChange');
      });

      this.cancelLastWatcher = cancel;

      if (!isDeepStrictEqual(realValue, this.cachedValue)) {
        this.emit('change');
        if (!isDependent) this.emit('independentChange');
      }
      this.cachedValue = realValue;
      return realValue;
    }

    return localValue;
  }

  get value() {
    return this.getValue();
  }

  getChild(key) {
    if (!key) return this;

    if (typeof key !== 'string' && !Array.isArray(key)) {
      throw new Error('Child key must be a string or array');
    }

    const [childKey, ...remainingKeys] = typeof key === 'string' ? key.split('.') : key;

    if (this.children.has(childKey)) {
      return remainingKeys.length
        ? this.children.get(childKey).getChild(remainingKeys)
        : this.children.get(childKey);
    }

    const newChild = new ConfigTree(this, childKey, this.pugfigure);
    newChild.addEventListener('independentChange', () => {
      this.emit('change');
      this.emit('independentChange');
    });


    this.children.set(childKey, immediateChild);
    return remainingKeys.length ? immediateChild.getChild(remainingKeys) : immediateChild;
  }

  // If bubble is truthy, the next ancestor with a cached value will be reloaded.
  //
  // If bubble is a number, the next ancestore with a cached value will be
  // reloaded if it is within that many steps of the current node.
  reload(bubble = true) {
    if (this.cachedValue === noCache) {
      if (bubble) {
        const newBubble = typeof bubble === 'number' ? bubble - 1 : bubble;
        this.parent.reload(newBubble);
      }
      return;
    }

    return this.getValue(true);
  }
}

