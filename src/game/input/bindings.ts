import { emptyInputFrameState, type InputFrameState } from './actions.ts';

export class InputBindings {
  private readonly root: HTMLElement;

  private dragPosition: InputFrameState['dragPosition'] = null;

  private dragPointerId: number | null = null;

  private fireHeld = false;

  private fireQueued = false;

  private rotateLeftHeld = false;

  private rotateRightHeld = false;

  private thrustHeld = false;

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
    const fire = this.fireHeld || this.fireQueued || this.dragPointerId !== null;

    this.fireQueued = false;

    return {
      dragActive: this.dragPointerId !== null,
      dragPosition: this.dragPosition,
      fire,
      rotateLeft: this.rotateLeftHeld,
      rotateRight: this.rotateRightHeld,
      thrust: this.thrustHeld,
    };
  }

  reset(): void {
    this.dragPosition = emptyInputFrameState.dragPosition;
    this.dragPointerId = null;
    this.fireHeld = emptyInputFrameState.fire;
    this.fireQueued = emptyInputFrameState.fire;
    this.rotateLeftHeld = emptyInputFrameState.rotateLeft;
    this.rotateRightHeld = emptyInputFrameState.rotateRight;
    this.thrustHeld = emptyInputFrameState.thrust;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditingText(event.target)) {
      return;
    }

    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      event.preventDefault();
      this.rotateLeftHeld = true;
    }

    if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      event.preventDefault();
      this.rotateRightHeld = true;
    }

    if (event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      this.thrustHeld = true;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      this.fireHeld = true;
      this.fireQueued = true;
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (isEditingText(event.target)) {
      return;
    }

    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      event.preventDefault();
      this.rotateLeftHeld = false;
    }

    if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      event.preventDefault();
      this.rotateRightHeld = false;
    }

    if (event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      this.thrustHeld = false;
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
    this.dragPosition = this.resolveDragPosition(event);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.dragPointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this.dragPosition = this.resolveDragPosition(event);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.dragPointerId !== event.pointerId) {
      return;
    }

    if (this.root.hasPointerCapture(event.pointerId)) {
      this.root.releasePointerCapture(event.pointerId);
    }

    this.dragPointerId = null;
    this.dragPosition = null;
  };

  private resolveDragPosition(event: PointerEvent): InputFrameState['dragPosition'] {
    const bounds = this.root.getBoundingClientRect();

    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }
}

function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
