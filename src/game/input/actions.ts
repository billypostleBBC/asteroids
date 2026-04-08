export type InputAction =
  | 'aim_drag_end'
  | 'aim_drag_move'
  | 'aim_drag_start'
  | 'fire'
  | 'pause'
  | 'rotate_left'
  | 'rotate_right';

export type InputFrameState = {
  dragActive: boolean;
  dragAngle: number | null;
  fire: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
};

export const emptyInputFrameState: InputFrameState = {
  dragActive: false,
  dragAngle: null,
  fire: false,
  rotateLeft: false,
  rotateRight: false,
};
