import { directive, PropertyPart } from 'lit-html';

import { ActionHandlerDetail, ActionHandlerOptions } from 'custom-card-helpers/dist/types';
import { fireEvent } from 'custom-card-helpers';

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

const MAX_CLICK_TIME = 250;
const HOLD_TIME = 500;
const MAX_HOLD_DISTANCE = 10;
const MIN_DRAG_DISTANCE = 15;
const DOUBLE_CLICK_DELAY = 250;

let startX = 0;
let startY = 0;
let startTime = 0;
let moved = false;
let dragStarted = false;

interface ActionHandler extends HTMLElement {
  holdTime: number;
  bind(element: Element, options): void;
}
interface ActionHandlerElement extends HTMLElement {
  actionHandler?: boolean;
}

declare global {
  interface HASSDomEvents {
    action: ActionHandlerDetail;
  }
}

class ActionHandler extends HTMLElement implements ActionHandler {
  public holdTime = 500;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public ripple: any;

  protected timer?: number;

  protected held = false;

  private dblClickTimeout?: number;

  constructor() {
    super();
    this.ripple = document.createElement('mwc-ripple');
  }

  public connectedCallback(): void {
    Object.assign(this.style, {
      position: 'absolute',
      width: isTouch ? '100px' : '50px',
      height: isTouch ? '100px' : '50px',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: '999',
    });

    this.appendChild(this.ripple);
    this.ripple.primary = true;

    ['touchcancel', 'mouseout', 'mouseup', 'touchmove', 'mousewheel', 'wheel', 'scroll'].forEach(ev => {
      document.addEventListener(
        ev,
        () => {
          clearTimeout(this.timer);
          this.stopAnimation();
          this.timer = undefined;
        },
        { passive: true },
      );
    });
  }

  public bind(element: ActionHandlerElement, options): void {
    if (element.actionHandler) {
      return;
    }
    element.actionHandler = true;

    element.addEventListener('contextmenu', (ev: Event) => {
      const e = ev || window.event;
      if (e.preventDefault) {
        e.preventDefault();
      }
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      e.cancelBubble = true;
      e.returnValue = false;
      return false;
    });

    const start = (ev: PointerEvent | TouchEvent): void => {
      this.held = false;
      dragStarted = false;
      moved = false;

      if ((ev as TouchEvent).touches) {
        startX = (ev as TouchEvent).touches[0].pageX;
        startY = (ev as TouchEvent).touches[0].pageY;
      } else {
        startX = (ev as MouseEvent).pageX;
        startY = (ev as MouseEvent).pageY;
      }
      startTime = Date.now();

      // Start hold timer
      if (options.hasHold) {
        this.timer = window.setTimeout(() => {
          if (!moved) {
            this.startAnimation(startX, startY);
            this.held = true;
            fireEvent(element, 'action', { action: 'hold' });
          }
        }, HOLD_TIME);
      }
    };

    const move = (ev: PointerEvent | TouchEvent): void => {
      let currentX, currentY;
      if ((ev as TouchEvent).touches) {
        currentX = (ev as TouchEvent).touches[0].pageX;
        currentY = (ev as TouchEvent).touches[0].pageY;
      } else {
        currentX = (ev as MouseEvent).pageX;
        currentY = (ev as MouseEvent).pageY;
      }
      const distance = Math.hypot(currentX - startX, currentY - startY);
      if (distance > MAX_HOLD_DISTANCE) {
        moved = true;
        clearTimeout(this.timer);
      }
      if (distance > MIN_DRAG_DISTANCE && !dragStarted) {
        dragStarted = true;
        element.style.cursor = 'grabbing';
      }
    };

    const end = (ev: PointerEvent | TouchEvent): void => {
      console.debug('Pointer ended', ev.type);
      clearTimeout(this.timer);
      this.stopAnimation();

      const duration = Date.now() - startTime;
      element.style.cursor = 'pointer';

      if (dragStarted || moved) {
        // treat as drag end, no click
        return;
      }

      if (this.held) return; // hold already fired

      const validClick = duration < MAX_CLICK_TIME;
      if (!validClick) return;

      // handle double click
      if (options.hasDoubleClick) {
        if (!this.dblClickTimeout) {
          this.dblClickTimeout = window.setTimeout(() => {
            this.dblClickTimeout = undefined;
            fireEvent(element, 'action', { action: 'tap' });
          }, DOUBLE_CLICK_DELAY);
        } else {
          clearTimeout(this.dblClickTimeout);
          this.dblClickTimeout = undefined;
          fireEvent(element, 'action', { action: 'double_tap' });
        }
      } else {
        fireEvent(element, 'action', { action: 'tap' });
      }
    };

    element.addEventListener('pointerdown', start);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
  }

  private startAnimation(x: number, y: number): void {
    Object.assign(this.style, {
      left: `${x}px`,
      top: `${y}px`,
      display: null,
    });
    this.ripple.disabled = false;
    this.ripple.active = true;
    this.ripple.unbounded = true;
  }

  private stopAnimation(): void {
    this.ripple.active = false;
    this.ripple.disabled = true;
    this.style.display = 'none';
  }
}

// TODO You need to replace all instances of "action-handler-boilerplate" with "action-handler-<your card name>"
customElements.define('action-handler-slider-button', ActionHandler);

const getActionHandler = (): ActionHandler => {
  const body = document.body;
  if (body.querySelector('action-handler-slider-button')) {
    return body.querySelector('action-handler-slider-button') as ActionHandler;
  }

  const actionhandler = document.createElement('action-handler-slider-button');
  body.appendChild(actionhandler);

  return actionhandler as ActionHandler;
};

export const actionHandlerBind = (element: ActionHandlerElement, options: ActionHandlerOptions): void => {
  const actionhandler: ActionHandler = getActionHandler();
  if (!actionhandler) {
    return;
  }
  actionhandler.bind(element, options);
};

export const actionHandler = directive((options: ActionHandlerOptions = {}) => (part: PropertyPart): void => {
  actionHandlerBind(part.committer.element as ActionHandlerElement, options);
});
