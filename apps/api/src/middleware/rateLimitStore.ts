import mongoose, { Schema } from 'mongoose';
import type { Store, Options } from 'express-rate-limit';

const schema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    resetTime: { type: Date, required: true },
  },
  { versionKey: false },
);

// Expired counters are removed by MongoDB's TTL monitor. This is a safety net,
// not part of correctness: the update path resets expired windows atomically.
schema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });

interface RateLimitDoc {
  key: string;
  count: number;
  resetTime: Date;
}

export const RateLimitModel =
  (mongoose.models as Record<string, mongoose.Model<RateLimitDoc>>).RateLimit ||
  mongoose.model<RateLimitDoc>('RateLimit', schema);

interface StoreOptions {
  prefix?: string;
}

export class MongoRateLimitStore implements Store {
  prefix: string = '';
  prefixKey: string = '';
  localKeys: boolean = false;
  windowMs?: number;

  constructor(options: StoreOptions = {}) {
    this.prefix = options.prefix ?? 'rl:';
  }

  init(options: Options): void {
    const opts = options as Options & { prefix?: string };
    if (typeof opts.prefix === 'string' && opts.prefix.length > 0) {
      this.prefixKey = opts.prefix;
      this.prefix = opts.prefix;
    } else if (this.prefixKey === '') {
      this.prefixKey = this.prefix;
    }
    if (typeof (options as Options & { windowMs?: number }).windowMs === 'number') {
      this.windowMs = (options as Options & { windowMs?: number }).windowMs;
    }
  }

  private getKey(key: string): string {
    return `${this.prefixKey}${key}`;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    const prefixedKey = this.getKey(key);
    const now = new Date();
    const windowMs = this.windowMs ?? 60_000;
    const resetTime = new Date(now.getTime() + windowMs);

    try {
      // Active window: increment in place.
      const incremented = await RateLimitModel.findOneAndUpdate(
        { key: prefixedKey, resetTime: { $gt: now } },
        { $inc: { count: 1 } },
        { new: true },
      ).exec();
      if (incremented) {
        return { totalHits: incremented.count, resetTime: incremented.resetTime };
      }

      // Expired window (TTL may not have removed it yet): reset atomically.
      const reset = await RateLimitModel.findOneAndUpdate(
        { key: prefixedKey, resetTime: { $lte: now } },
        { $set: { count: 1, resetTime } },
        { new: true },
      ).exec();
      if (reset) {
        return { totalHits: reset.count, resetTime: reset.resetTime };
      }

      // No document yet, or another request inserted one between the two
      // operations: increment the winner if it is active.
      const raced = await RateLimitModel.findOneAndUpdate(
        { key: prefixedKey, resetTime: { $gt: new Date() } },
        { $inc: { count: 1 } },
        { new: true },
      ).exec();
      if (raced) {
        return { totalHits: raced.count, resetTime: raced.resetTime };
      }

      const created = await RateLimitModel.create({
        key: prefixedKey,
        count: 1,
        resetTime,
      });
      return { totalHits: created.count, resetTime: created.resetTime };
    } catch {
      // Duplicate-key race on first insert: exactly one writer creates the
      // document, so the loser can safely increment it.
      try {
        const retried = await RateLimitModel.findOneAndUpdate(
          { key: prefixedKey, resetTime: { $gt: new Date() } },
          { $inc: { count: 1 } },
          { new: true },
        ).exec();
        if (retried) {
          return { totalHits: retried.count, resetTime: retried.resetTime };
        }
        const reset = await RateLimitModel.findOneAndUpdate(
          { key: prefixedKey, resetTime: { $lte: new Date() } },
          { $set: { count: 1, resetTime: new Date(Date.now() + windowMs) } },
          { new: true },
        ).exec();
        if (reset) {
          return { totalHits: reset.count, resetTime: reset.resetTime };
        }
        throw new Error('rate_limit_store_unavailable');
      } catch {
        throw new Error('rate_limit_store_unavailable');
      }
    }
  }

  async decrement(key: string): Promise<void> {
    const prefixedKey = this.getKey(key);
    try {
      await RateLimitModel.updateOne({ key: prefixedKey }, { $inc: { count: -1 } }).exec();
    } catch {
      // Best-effort only.
    }
  }

  async resetKey(key: string): Promise<void> {
    const prefixedKey = this.getKey(key);
    try {
      await RateLimitModel.deleteOne({ key: prefixedKey }).exec();
    } catch {
      // Best-effort only.
    }
  }
}
