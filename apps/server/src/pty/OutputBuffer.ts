import { MAX_OUTPUT_BUFFER_SIZE } from '@termify/shared';

/**
 * Circular buffer for terminal output
 * Keeps the last N bytes of output for reconnection support
 */
export class OutputBuffer {
  private buffer: string = '';
  private maxSize: number;

  constructor(maxSize: number = MAX_OUTPUT_BUFFER_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * Append data to the buffer, trimming old data if necessary
   */
  append(data: string): void {
    this.buffer += data;

    // Trim from the beginning if we exceed max size
    if (this.buffer.length > this.maxSize) {
      // Find a good break point (newline) to avoid cutting mid-line
      const trimPoint = this.buffer.length - this.maxSize;
      const newlineIndex = this.buffer.indexOf('\n', trimPoint);

      if (newlineIndex !== -1 && newlineIndex < trimPoint + 1000) {
        this.buffer = this.buffer.slice(newlineIndex + 1);
      } else {
        this.buffer = this.buffer.slice(trimPoint);
      }
    }
  }

  /**
   * Get the current buffer contents
   */
  getContents(): string {
    return this.buffer;
  }

  /**
   * Get buffer as bytes for storage
   */
  getBytes(): Buffer {
    return Buffer.from(this.buffer, 'utf-8');
  }

  /**
   * Load buffer from bytes
   */
  loadFromBytes(bytes: Buffer): void {
    this.buffer = bytes.toString('utf-8');
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = '';
  }

  /**
   * Get the current size of the buffer
   */
  get size(): number {
    return this.buffer.length;
  }
}
