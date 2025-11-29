/**
 * SmartQueue - Efficient linked-list based queue with slot batching
 * Optimized for high-throughput enqueue/dequeue operations
 */

interface QueueNode<T> {
  prev: QueueNode<T> | null
  next: QueueNode<T> | null
  slot: Array<T | null>
}

export class SmartQueue<T> {
  private readonly slotSize = 0xfeff
  private headNode: QueueNode<T>
  private tailNode: QueueNode<T>
  private head = 0
  private tail = 0

  constructor() {
    this.headNode = this.tailNode = {
      prev: null,
      next: null,
      slot: Array(this.slotSize).fill(null),
    }
  }

  enqueue(item: T): void {
    if (this.slotSize === this.tail) {
      this.tailNode.next = {
        prev: this.tailNode,
        next: null,
        slot: Array(this.slotSize).fill(null),
      }
      this.tailNode = this.tailNode.next
      this.tail = 0
    }
    this.tailNode.slot[this.tail++] = item
  }

  dequeue(): T | null {
    if (this.isEmpty()) {
      return null
    }

    if (this.head === this.slotSize) {
      if (!this.headNode.next) {
        return null
      }
      this.headNode = this.headNode.next
      this.headNode.prev = null
      this.head = 0
    }

    const item = this.headNode.slot[this.head] ?? null
    this.headNode.slot[this.head] = null
    this.head++
    return item
  }

  isEmpty(): boolean {
    return this.head === this.tail && this.headNode === this.tailNode
  }

  peek(): T | null {
    if (this.isEmpty()) {
      return null
    }
    return this.headNode.slot[this.head] ?? null
  }

  clear(): void {
    this.headNode = this.tailNode = {
      prev: null,
      next: null,
      slot: Array(this.slotSize).fill(null),
    }
    this.head = 0
    this.tail = 0
  }

  get length(): number {
    let count = 0
    let currentNode: QueueNode<T> | null = this.headNode
    let localHead = this.head

    while (currentNode !== null) {
      if (currentNode === this.tailNode) {
        count += Math.max(0, this.tail - localHead)
        break
      }
      count += Math.max(0, this.slotSize - localHead)
      localHead = 0
      currentNode = currentNode.next
    }

    return count
  }

  hasAny(predicate: (item: T) => boolean): boolean {
    let currentNode: QueueNode<T> | null = this.headNode
    let localHead = this.head

    while (currentNode !== null) {
      const isLastNode = currentNode === this.tailNode
      const limit = isLastNode ? this.tail : this.slotSize

      for (let i = localHead; i < limit; i++) {
        const item = currentNode.slot[i] ?? null
        if (item !== null && predicate(item)) {
          return true
        }
      }

      localHead = 0
      currentNode = currentNode.next
    }

    return false
  }

  forEach(callback: (item: T) => void): void {
    let currentNode: QueueNode<T> | null = this.headNode
    let localHead = this.head

    while (currentNode !== null) {
      const isLastNode = currentNode === this.tailNode
      const limit = isLastNode ? this.tail : this.slotSize

      for (let i = localHead; i < limit; i++) {
        const item = currentNode.slot[i] ?? null
        if (item !== null) {
          callback(item)
        }
      }

      localHead = 0
      currentNode = currentNode.next
    }
  }
}
