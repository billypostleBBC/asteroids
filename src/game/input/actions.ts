export type InputAction =
  | 'aim_drag_end'
  | 'aim_drag_move'
  | 'aim_drag_start'
  | 'brake'
  | 'fire'
  | 'pause'
  | 'rotate_left'
  | 'rotate_right'
  | 'thrust';

export type PointerInput = {
  x: number;
  y: number;
};

export type InputFrameState = {
  brake: boolean;
  dragActive: boolean;
  dragPosition: PointerInput | null;
  fire: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  thrust: boolean;
};

export const emptyInputFrameState: InputFrameState = {
  brake: false,
  dragActive: false,
  dragPosition: null,
  fire: false,
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
};
