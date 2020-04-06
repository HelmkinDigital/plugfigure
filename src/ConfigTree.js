import EventEmitter from 'events';
import { isDeepStrictEqual } from 'util';

const noCache = Symbol('No Cache'); // Use symbol so we can cache null and undefined

export default class ConfigTree extends EventEmitter {
  constructor(parent, key, plugfigure) {
    super();
    this.parent = parent;
    if (parent instanceof ConfigTree) {
      this.parent.on('change', async () => {
        const oldRaw = this.cachedRaw;
        const newRaw = await this.getRawValue(true);
        if (isDeepStrictEqual(oldRaw, newRaw)) return;
        this.getValue(true, true);
      });
    }

    this.myKey = key;
    this.plugfigure = plugfigure;
    this.isEvaluated = false;
    this.cachedValue = noCache;
    this.cachedRaw = noCache;
    this.children = new Map();
    this.cancelLastWatcher = () => {};
    this.evalLocked = false;
  }

  async getRawValue(skipCache) {
    if (this.cachedRaw !== noCache && !skipCache) {
      return this.cachedRaw;
    }

    const parentValue = this.parent instanceof ConfigTree ? await this.parent.getValue() : this.parent;
    if (!parentValue) return undefined;

    const rawValue = this.myKey ? parentValue[this.myKey] : parentValue; // Will probably only be false for root nodes
    this.cachedRaw = rawValue;
    return rawValue;
  }

  async getValue(forceReevaluation, isDependent) {
    if (this.cachedValue !== noCache && !forceReevaluation) {
      return this.cachedValue;
    }

    let newValue = await this.getRawValue();

    const isEvaluated = typeof newValue === 'string' && newValue.startsWith('@');

    if (isEvaluated) {
      this.cancelLastWatcher();

      const {
        value: realValue,
        cancel,
      } = await this.plugfigure.getPluginValue(newValue, (newDirectValue) => {
        if (isDeepStrictEqual(this.cachedValue, newDirectValue)) return;
        this.cachedValue = newDirectValue;
        setImmediate(() => this.emit('change'));
        setImmediate(() => this.emit('independentChange'));
      });

      this.cancelLastWatcher = cancel;

      newValue = realValue;
    }

    if (this.cachedValue !== noCache && !isDeepStrictEqual(newValue, this.cachedValue)) {
      setImmediate(() => this.emit('change'));
      if (!isDependent && this.cachedValue !== noCache) {
        setImmediate(() => this.emit('independentChange'));
      }
    }

    this.cachedValue = newValue;
    this.isEvaluated = isEvaluated;

    return newValue;
  }

  get value() {
    return this.getValue();
  }

  key(key) {
    if (!key) return this;

    if (typeof key !== 'string' && !Array.isArray(key)) {
      throw new Error('Child key must be a string or array');
    }

    const [childKey, ...remainingKeys] = typeof key === 'string' ? key.split('.') : key;

    if (this.children.has(childKey)) {
      return remainingKeys.length
        ? this.children.get(childKey).key(remainingKeys)
        : this.children.get(childKey);
    }

    const newChild = new ConfigTree(this, childKey, this.plugfigure);
    newChild.on('independentChange', () => {
      setImmediate(() => this.emit('change'));
      setImmediate(() => this.emit('independentChange'));
    });


    this.children.set(childKey, newChild);
    return remainingKeys.length ? newChild.key(remainingKeys) : newChild;
  }

  // If bubble is truthy, the next ancestor with a cached value will be reloaded.
  //
  // If bubble is a number, the next ancestore with a cached value will be
  // reloaded if it is within that many steps of the current node.
  reload(bubble = true) {
    if (!this.isEvaluated) {
      if (bubble) {
        const newBubble = typeof bubble === 'number' ? bubble - 1 : bubble;
        if (this.parent instanceof ConfigTree) this.parent.reload(newBubble);
      }
      return;
    }

    return this.getValue(true);
  }
}

