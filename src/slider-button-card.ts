/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
import { ActionHandlerEvent, applyThemesOnElement, handleAction, hasConfigOrEntityChanged, HomeAssistant, LovelaceCard, LovelaceCardEditor } from 'custom-card-helpers';
import copy from 'fast-copy';
import { customElement, eventOptions, html, LitElement, property, PropertyValues, query, state, TemplateResult, CSSResult, CSSResultArray } from 'lit-element';
import { CARD_VERSION } from './const';
import { Controller } from './controllers/controller';
import { ControllerFactory } from './controllers/get-controller';
import './editor';
import { localize, setLanguage } from './localize/localize';
import type { SliderButtonCardConfig } from './types';
import { ActionButtonConfigDefault, IconConfigDefault, SliderDirection } from './types';
import { getSliderDefaultForEntity, normalize, toRGBAWithAlpha } from './utils';
import { sliderButtonCardStyles } from './slider-button-card-css';
import { renderSliderButtonCard } from './slider-button-card-html';

// This prints card name and verison to console
console.info(
  `%c  SLIDER-BUTTON-CARD %c ${localize('common.version')}${CARD_VERSION} %c`,
  'background-color: #555;color: #fff;padding: 3px 2px 3px 3px;border: 1px solid #555;border-radius: 3px 0 0 3px;font-family: Roboto,Verdana,Geneva,sans-serif;text-shadow: 0 1px 0 rgba(1, 1, 1, 0.3)',
  'background-color: transparent;color: #555;padding: 3px 3px 3px 2px;border: 1px solid #555; border-radius: 0 3px 3px 0;font-family: Roboto,Verdana,Geneva,sans-serif',
  'background-color: transparent'
);

// This puts your card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'slider-button-card',
  name: 'Slider button Card',
  description: 'A button card with slider',
  preview: true,
});

@customElement('slider-button-card')
export class SliderButtonCard extends LitElement implements LovelaceCard {
  @property({attribute: false}) public hass!: HomeAssistant;
  @state() private config!: SliderButtonCardConfig;
  @query('.state') stateText;
  @query('.button') button;
  @query('.action') action;
  @query('.slider') slider;
  private ctrl!: Controller;

  private readonly MAX_CLICK_TIME = 150;
  private readonly HOLD_TIME = 500;
  private readonly DOUBLE_CLICK_DELAY = 250;
  private readonly MAX_CLICK_DISTANCE = 5;

  private startX = 0;
  private startY = 0;
  private lastTapTime = 0;
  private everLeftMaxDist = false;

  private holdTimer: number | null = null;
  private lastPointerId: number | null = null;

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('slider-button-card-editor');
  }

  public static getStubConfig(_hass: HomeAssistant, entities: string[]): object {
    const entity = entities.find(item => item.startsWith('light')) || '';
    return {
      entity: entity,
      slider: getSliderDefaultForEntity(entity),
      show_name: true,
      show_state: true,
      compact: false,
      icon: copy(IconConfigDefault),
      action_button: copy(ActionButtonConfigDefault),
    };
  }
  public getCardSize(): number {
    return 0;
  }

  public setConfig(config: SliderButtonCardConfig): void {
    if (!config) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (!config.entity) {
      throw new Error(localize('common.invalid_configuration'));
    }

    this.config = {
      slider: getSliderDefaultForEntity(config.entity),
      icon: copy(IconConfigDefault),
      show_name: true,
      show_state: true,
      compact: false,
      action_button: copy(ActionButtonConfigDefault),
      debug: false,
      ...config
    };
    this.ctrl = ControllerFactory.getInstance(this.config);
    
    setLanguage(this.hass); // Initialize language
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.config) {
      return false;
    }
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    if (
      !oldHass ||
      oldHass.themes !== this.hass.themes ||
      oldHass.language !== this.hass.language
    ) {
      this.ctrl.log('shouldUpdate', 'forced true');
      return true;
    }
    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  protected updated(changedProps: PropertyValues): void {
    this.updateValue(this.ctrl.value, false);
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    const oldConfig = changedProps.get('config') as
      | SliderButtonCardConfig
      | undefined;
    if (
      oldHass?.themes !== this.hass.themes ||
      oldConfig?.theme !== this.config.theme
    ) {
      this.ctrl.log('Theme','updated');
      applyThemesOnElement(this, this.hass.themes, this.config.theme);
    }
    this.ctrl.log('Updated', this.ctrl.value);
    if (this.action) this._bindClickActions(this.action, this.config.action_button);
    if (this.shadowRoot?.querySelector(".icon"))
      this._bindClickActions(this.shadowRoot.querySelector(".icon") as HTMLElement, this.config.icon);
  }

  protected render(): TemplateResult | void {
    this.ctrl.hass = this.hass;
    if (!this.ctrl.stateObj) {
      return this._showError(localize('common.show_error'));
    }
    return renderSliderButtonCard(this);
  }


  /*#############################################
  #                                             #
  #    action button and icon click behavior    #
  #                                             #
  #############################################*/

  private _bindClickActions(element: HTMLElement, config: any): void {

    element.addEventListener("pointerdown", () => {
      this.holdTimer = window.setTimeout(() => {
        this._handleAction({ detail: { action: "hold" } } as any, config);
        this.holdTimer = null;
      }, this.HOLD_TIME);
    });

    element.addEventListener("pointerup", () => {
      const now = Date.now();
      if (!this.holdTimer) return;
      clearTimeout(this.holdTimer);
      this.holdTimer = null;

      const hasDoubleTapAction =
        !!config?.double_tap_action &&
        config.double_tap_action.action !== "none";

      if (hasDoubleTapAction) {
        if (now - this.lastTapTime < this.DOUBLE_CLICK_DELAY) {
          this._handleAction({ detail: { action: "double_tap" } } as any, config);
          this.lastTapTime = 0;
        } else {
          this.lastTapTime = now;
          window.setTimeout(() => {
            if (Date.now() - this.lastTapTime >= this.DOUBLE_CLICK_DELAY && this.lastTapTime !== 0) {
              this._handleAction({ detail: { action: "tap" } } as any, config);
              this.lastTapTime = 0;
            }
          }, this.DOUBLE_CLICK_DELAY);
        }
      } else {
        this._handleAction({ detail: { action: "tap" } } as any, config);
        this.lastTapTime = now;
      }
    });
  }

  
  /*#############################################
  #                                             #
  #   map config action to hass call service    #
  #                                             #
  #############################################*/

  private _executeAction(actionConfig: any): void {
    if (!this.hass || !actionConfig || actionConfig.action === "none") return;

    const { action } = actionConfig;

    switch (action) {
      case "toggle": {
        const entity = actionConfig.entity || this.config.entity;
        if (entity) {
          const [domain, name] = entity.split(".");
          this.hass.callService(domain, "toggle", { entity_id: entity });
        }
        break;
      }

      case "call-service": {
        const [domain, service] = actionConfig.service.split(".");
        const data = {
          ...(actionConfig.service_data || {}),
          ...(actionConfig.target ? { target: actionConfig.target } : {}),
        };
        this.hass.callService(domain, service, data);
        break;
      }

      case "perform-action": {
        const [domain, service] = actionConfig.perform_action.split(".");
        const data = {
          ...(actionConfig.data || {}),
          ...(actionConfig.target ? { ...actionConfig.target } : {}),
        };
        this.hass.callService(domain, service, data);
        break;
      }

      case "more-info": {
        const entity = actionConfig.entity || this.config.entity;
        const event = new CustomEvent("hass-more-info", {
          composed: true,
          bubbles: true,
          detail: { entityId: entity },
        });
        this.dispatchEvent(event);
        break;
      }

      case "navigate": {
        if (actionConfig.navigation_path) {
          history.pushState(null, "", actionConfig.navigation_path);
          window.dispatchEvent(new Event("location-changed"));
        }
        break;
      }

      case "url": {
        if (actionConfig.url_path) window.open(actionConfig.url_path, "_blank");
        break;
      }

      default:
        console.warn("Unknown action type:", action);
    }
  }



  private _handleAction(ev: ActionHandlerEvent, config): void {
    if (!ev?.detail?.action || !config) return;

    const type = ev.detail.action;
    const actionConfig = config?.[`${type}_action`] || config;

    this._executeAction(actionConfig);
  }

  private _sliderAction(ev: ActionHandlerEvent, config): void {
    if (this.everLeftMaxDist){return;}
    if (this.hass && this.config && ev.detail.action) {
      let actionConfig;
      switch(ev.detail.action) {
        case 'hold':
          this.slider.releasePointerCapture?.(this.lastPointerId);
          actionConfig = config.hold_action;
          break;
        case 'double_tap':
          actionConfig = config.double_tap_action;
          break;
        default:
          actionConfig = config.tap_action;
      }
  
      if (!actionConfig || actionConfig.action === "none") return;
      this._executeAction(actionConfig);
    }
  }



  private setStateValue(value: number): void {
    this.ctrl.log('setStateValue', value);
    this.updateValue(value, false);
    this.ctrl.value = value;
  }

  private updateValue(value: number, changing = true): void {
    if (changing) {
      const min = this.config.slider?.min_value ?? 0;
      const max = this.config.slider?.max_value ?? 100;
      value = Math.max(min, Math.min(value, max));
    }
    
    this.ctrl.targetValue = value;
    if (!this.button) {
      return
    }
    this.button.classList.remove('off');
    if (changing) {
      this.button.classList.add('changing');
    } else {
      this.button.classList.remove('changing');
      if (this.ctrl.isOff) {
        this.button.classList.add('off');
      }
    }
    if (this.stateText) {
      this.stateText.innerHTML = this.ctrl.isUnavailable ? `${this.hass.localize('state.default.unavailable')}` : this.ctrl.label;
    }
    this.button.style.setProperty('--slider-value', `${this.ctrl.percentage}%`);
    this.button.style.setProperty('--slider-bg-filter', this.ctrl.style.slider.filter);
    this.button.style.setProperty('--slider-color', this.ctrl.style.slider.color);
    this.button.style.setProperty('--icon-filter', this.ctrl.style.icon.filter);
    this.button.style.setProperty('--icon-color', this.ctrl.style.icon.color);

    // icon-background opacity:0.2 causes issues on transition so I had to put opacity into the color
    this.button.style.setProperty('--icon-bg-color', `color-mix(in srgb, ${this.ctrl.style.icon.color} 20%, transparent)`);
  }

  private _showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card');
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this.config
    });

    return html`
      ${errorCard}
    `;
  }


  /*################################
  #                                #
  #         onPointerDown          #
  #                                #
  ################################*/
  private onPointerDown(event: PointerEvent): void {
    if (this.config.slider?.direction === SliderDirection.TOP_BOTTOM
    || this.config.slider?.direction === SliderDirection.BOTTOM_TOP) {
      event.preventDefault();
    }

    // event.stopPropagation();

    this.lastPointerId = event.pointerId;
    this.slider.setPointerCapture(event.pointerId);

    this.holdTimer = window.setTimeout(() => {
      if (!this.everLeftMaxDist) {
        this._sliderAction({ detail: { action: 'hold' } } as any, this.config.slider);
      }
    }, this.HOLD_TIME);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let oldPercentage;
    if (this.ctrl.originalValueLock != true) {
      this.ctrl.originalValue = this.ctrl.value;
      this.ctrl.originalValueLock = true;
    }
    
    // eslint-disable-next-line prefer-const
    oldPercentage = this.ctrl.originalValue;

    this.everLeftMaxDist = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
  }


  /*################################
  #                                #
  #         onPointerMove          #
  #                                #
  ################################*/
  @eventOptions({passive: true})
  private onPointerMove(event: any): void {
    if (this.ctrl.isSliderDisabled || !this.slider.hasPointerCapture(event.pointerId)) {
      return;
    }

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    const distance = Math.hypot(dx, dy);
    if (distance > this.MAX_CLICK_DISTANCE && this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    const isVertical = this.config.slider?.direction === SliderDirection.TOP_BOTTOM
      || this.config.slider?.direction === SliderDirection.BOTTOM_TOP;

    const deltaPixel = Math.abs(
      isVertical ? event.clientY - this.startY : event.clientX - this.startX
    );

    if (!this.everLeftMaxDist && (deltaPixel > this.MAX_CLICK_DISTANCE)) {
      this.everLeftMaxDist = true;
    }
    if (this.everLeftMaxDist) {
      this.slider.style.cursor = 'grabbing';
    }
    
    if (this.everLeftMaxDist) {
      const {left, top, width, height} = this.slider.getBoundingClientRect();
      this.ctrl.log('event', event);

      const percentage = this.ctrl.moveSlider(event, {left, top, width, height});

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let clickPosition;
      if (this.ctrl.clickPositionLock != true)
      {
        this.ctrl.clickPosition = percentage;
        this.ctrl.clickPositionLock = true;
      }
      // eslint-disable-next-line prefer-const
      clickPosition = this.ctrl.clickPosition;

      // eslint-disable-next-line prefer-const
      let delta = this.ctrl.clickPosition - percentage;
      let newPercentage = this.ctrl.originalValue - delta;
      newPercentage = normalize(newPercentage, this.ctrl.min, this.ctrl.max)

      //console.log('oldPercentage', this.ctrl.originalValue);
      //console.log('clickPosition', clickPosition);
      //console.log('onPointerMove', percentage);
      //console.log('delta', delta);
      //console.log('newPercentage', newPercentage);

      this.updateValue(newPercentage);
    }
  }


  /*################################
  #                                #
  #          onPointerUp           #
  #                                #
  ################################*/
  @eventOptions({passive: true})
  private onPointerUp(event: PointerEvent): void {
    this.slider.style.cursor = 'pointer';
    this.setStateValue(this.ctrl.targetValue);
    this.slider.releasePointerCapture(event.pointerId);
    this.ctrl.originalValueLock = false;
    this.ctrl.clickPositionLock = false;

    if (this.ctrl.isSliderDisabled) return;

    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    if (this.everLeftMaxDist) {
      this.everLeftMaxDist = false;
      return;
    }
    this.everLeftMaxDist = false;
    
    // --- handle click & double clicks ---
    const now = Date.now();
    const hasDoubleTapAction = !!this.config.slider?.double_tap_action && this.config.slider.double_tap_action.action !== 'none';

    if (hasDoubleTapAction) {
      // Wait to see if a second click occurs within the delay
      if (now - this.lastTapTime < this.DOUBLE_CLICK_DELAY) {
        this._sliderAction({ detail: { action: 'double_tap' } } as any, this.config.slider);
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = now;

        // Trigger click only after delay expires (in case of double tap)
        window.setTimeout(() => {
          if (Date.now() - this.lastTapTime >= this.DOUBLE_CLICK_DELAY && this.lastTapTime !== 0) {
            this._sliderAction({ detail: { action: 'tap' } } as any, this.config.slider);
            this.lastTapTime = 0;
          }
        }, this.DOUBLE_CLICK_DELAY);
      }
    } else {
      // No double-tap configured → trigger tap immediately
      this._sliderAction({ detail: { action: 'tap' } } as any, this.config.slider);
      this.lastTapTime = now;
    }
  }

  
  /*################################
  #                                #
  #        onPointerCancel         #
  #                                #
  ################################*/
  private onPointerCancel(event: PointerEvent): void {
    this.slider.style.cursor = 'pointer';
    this.everLeftMaxDist = false;
    this.updateValue(this.ctrl.value, false);
    this.slider.releasePointerCapture(event.pointerId);
    this.ctrl.originalValueLock = false;
    this.ctrl.clickPositionLock = false;
  }

  static get styles(): CSSResult | CSSResultArray {
    return sliderButtonCardStyles;
  }
}
