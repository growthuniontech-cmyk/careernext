/**
 * Minimal 2D DOMMatrix polyfill for Node.js server environments.
 *
 * pdf-parse (via pdfjs-dist) references the browser-only `DOMMatrix` API at
 * module top level (e.g. `const SCALE_MATRIX = new DOMMatrix();`), which
 * crashes on import in serverless runtimes that lack it. This implements
 * exactly the subset of the DOMMatrix spec pdfjs-dist's text-extraction path
 * uses: 2D affine construction, translate/scale/multiply (non-mutating,
 * return a new matrix per spec), and the mutating *Self variants.
 *
 * Matrix layout matches the CSS/SVG 2D convention:
 *   | a  c  e |
 *   | b  d  f |
 *   | 0  0  1 |
 */
class Matrix2D {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[] | { a: number; b: number; c: number; d: number; e: number; f: number }) {
    if (Array.isArray(init)) {
      if (init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      } else if (init.length === 0) {
        // identity
      } else {
        throw new Error(`DOMMatrix polyfill: unsupported init array length ${init.length}`);
      }
    } else if (init) {
      this.a = init.a;
      this.b = init.b;
      this.c = init.c;
      this.d = init.d;
      this.e = init.e;
      this.f = init.f;
    }
  }

  /** this * other (other's transform applied first) */
  multiply(other: Matrix2D): Matrix2D {
    return new Matrix2D([
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f,
    ]);
  }

  multiplySelf(other: Matrix2D): this {
    const result = this.multiply(other);
    Object.assign(this, result);
    return this;
  }

  /** this = other * this (this's transform applied first) */
  preMultiplySelf(other: Matrix2D): this {
    const result = other.multiply(this);
    Object.assign(this, result);
    return this;
  }

  translate(tx: number, ty: number): Matrix2D {
    return this.multiply(new Matrix2D([1, 0, 0, 1, tx, ty]));
  }

  translateSelf(tx: number, ty: number): this {
    return this.multiplySelf(new Matrix2D([1, 0, 0, 1, tx, ty]));
  }

  scale(sx: number, sy?: number): Matrix2D {
    return this.multiply(new Matrix2D([sx, 0, 0, sy ?? sx, 0, 0]));
  }

  scaleSelf(sx: number, sy?: number): this {
    return this.multiplySelf(new Matrix2D([sx, 0, 0, sy ?? sx, 0, 0]));
  }

  invertSelf(): this {
    const { a, b, c, d, e, f } = this;
    const det = a * d - b * c;
    if (det === 0) {
      // Per spec, a non-invertible matrix becomes all-NaN and `is2D`/etc.
      // flip to reflect that. We only need to not throw here.
      this.a = this.b = this.c = this.d = this.e = this.f = NaN;
      return this;
    }
    this.a = d / det;
    this.b = -b / det;
    this.c = -c / det;
    this.d = a / det;
    this.e = (c * f - d * e) / det;
    this.f = (b * e - a * f) / det;
    return this;
  }

  get is2D(): boolean {
    return true;
  }
}

/** Call once, before importing pdf-parse/pdfjs-dist. Idempotent. */
export function installDomMatrixPolyfill() {
  if (!globalThis.DOMMatrix) {
    (globalThis as unknown as { DOMMatrix: typeof Matrix2D }).DOMMatrix = Matrix2D;
  }
}
