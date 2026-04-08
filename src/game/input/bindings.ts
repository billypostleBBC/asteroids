import { emptyInputFrameState, type InputFrameState } from './actions.ts';

export class InputBindings {
  private readonly root: HTMLElement;

  private dragAngle: number | null = null;

  private dragPointerId: number | null = null;

  private fireHeld = false;

  private rotateLeftHeld = false;

  private rotateRightHeld = false;

  constructor(root: HTMLElement) {
    this.root = root;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    root.addEventListener('pointerdown', this.handlePointerDown);
    root.addEventListener('pointermove', this.handlePointerMove);
    root.addEventListener('pointerup', this.handlePointerUp);
    root.addEventListener('pointercancel', this.handlePointerUp);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.root.removeEventListener('pointerdown', this.handlePointerDown);
    this.root.removeEventListener('pointermove', this.handlePointerMove);
    this.root.removeEventListener('pointerup', this.handlePointerUp);
    this.root.removeEventListener('pointercancel', this.handlePointerUp);
  }

  getFrameState(): InputFrameState {
    return {
      dragActive: this.dragPointerId !== null,
      dragAngle: this.dragAngle,
      fire: this.fireHeld || this.dragPointerId !== null,
      rotateLeft: this.rotateLeftHeld,
      rotateRight: this.rotateRightHeld,
    };
  }

  reset(): void {
    this.dragAngle = emptyInputFrameState.dragAngle;
    this.dragPointerId = null;
    this.fireHeld = emptyInputFrameState.fire;
    this.rotateLeftHeld = emptyInputFrameState.rotateLeft;
    this.rotateRightHeld = emptyInputFrameState.rotateRight;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      this.rotateLeftHeld = true;
    }

    if (event.code === 'ArrowRight') {
      event.preventDefault();
      this.rotateRightHeld = true;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      this.fireHeld = true;
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      this.rotateLeftHeld = false;
    }

    if (event.code === 'ArrowRight') {
      event.preventDefault();
      this.rotateRightHeld = false;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      this.fireHeld = false;
    }
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      return;
    }

    event.preventDefault();
    this.dragPointerId = event.pointerId;
    this.root.setPointerCapture(event.pointerId);
    this.dragAngle = this.resolveDragAngle(event);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.dragPointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this.dragAngle = this.resolveDragAngle(event);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.dragPointerId !== event.pointerId) {
      return;
    }

    if (this.root.hasPointerCapture(event.pointerId)) {
      this.root.releasePointerCapture(event.pointerId);
    }

    this.dragPointerId = null;
    this.dragAngle = null;
  };

  private resolveDragAngle(event: PointerEvent): number {
    const bounds = this.root.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    return Math.atan2(event.clientY - centerY, event.clientX - centerX);
  }
}
