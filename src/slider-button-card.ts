/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
import { ActionHandlerEvent, applyThemesOnElement, computeStateDomain, hasConfigOrEntityChanged, HomeAssistant, LovelaceCard, LovelaceCardEditor } from './ha-helpers';
import { css, html, LitElement, PropertyValues, TemplateResult, CSSResultGroup } from 'lit';
import { customElement, eventOptions, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { Controller } from './controllers/controller';
import { ControllerFactory } from './controllers/get-controller';
import './editor';
import type { SliderButtonCardConfig } from './types';
import { ActionButtonConfigDefault, IconConfigDefault, SliderDirection } from './types';
import { getSliderDefaultForEntity, normalize } from './utils';

// This prints card name and verison to console
console.info(
  `%c  SLIDER-BUTTON-CARD %c Version 1.13.0 %c`,
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
      icon: structuredClone(IconConfigDefault),
      action_button: structuredClone(ActionButtonConfigDefault),
    };
  }
  public getCardSize(): number {
    return 0;
  }

  public setConfig(config: SliderButtonCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    if (!config.entity) {
      throw new Error('Invalid configuration');
    }

    this.config = {
      slider: getSliderDefaultForEntity(config.entity),
      icon: structuredClone(IconConfigDefault),
      show_name: true,
      show_state: true,
      compact: false,
      action_button: structuredClone(ActionButtonConfigDefault),
      debug: false,
      ...config
    };
    this.ctrl = ControllerFactory.getInstance(this.config);
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
      return this._showError('Error loading slider-button-card');
    }

    const { config, ctrl } = this;

    return html`
      <overflow_fix>
        <ha-card
          tabindex="0"
          .label=${`SliderButton: ${config.entity || 'No Entity Defined'}`}
          class="${classMap({
            'hide-name': !config.show_name,
            'hide-state': !config.show_state,
            'hide-action': !config.action_button?.show,
            compact: config.compact === true,
          })}"
          data-mode="${config.slider?.direction}"
        >
          <div class="button 
            ${classMap({ off: ctrl.isOff, unavailable: ctrl.isUnavailable })}"
            data-mode="${config.slider?.direction}"
            style=${styleMap({
              '--slider-value': `${ctrl.percentage}%`,
              '--slider-bg-filter': ctrl.style.slider.filter,
              '--slider-color': ctrl.style.slider.color,
              '--icon-filter': ctrl.style.icon.filter,
              '--icon-color': ctrl.style.icon.color,
            })}
          >
            <div class="slider"
              @action=${(e: Event): void => this._sliderAction(e as any, config.slider)}
              data-show-track="${config.slider?.show_track}"
              data-mode="${config.slider?.direction}"
              data-background="${config.slider?.background}"
              data-disable-sliding="${ctrl.disableSliding}"
              @pointerdown=${this.onPointerDown}
              @pointermove=${this.onPointerMove}
              @pointerup=${this.onPointerUp}
              @pointercancel=${this.onPointerCancel}
            >
              ${ctrl.disableSliding ? html`<div class="toggle-overlay"></div>` : ''}
              <div class="slider-bg"></div>
              <div class="slider-thumb"></div>
            </div>
            
            ${this._renderScrollHelper()}
            ${this._renderAction()}
            ${this._renderIcon()}
            ${this._renderText()}
          </div>
        </ha-card>
      </overflow_fix>
    `;
  }

  private _renderScrollHelper(): TemplateResult {
    const isVertical = this.config.slider?.direction === SliderDirection.TOP_BOTTOM || this.config.slider?.direction === SliderDirection.BOTTOM_TOP;
    return isVertical ? html`<div class="mobile-vertical-scroll-helper"></div>` : html``;
  }

  private _renderIcon(): TemplateResult {
    const { config, ctrl } = this;
    if (config.icon?.show === false) return html``;

    let hasPicture = false;
    let backgroundImage = '';
    if (ctrl.stateObj.attributes.entity_picture) {
      backgroundImage = `url(${ctrl.stateObj.attributes.entity_picture})`;
      hasPicture = true;
    }

    const iconConfig = config.icon || {};
    const noAction = (!iconConfig.tap_action || iconConfig.tap_action.action === 'none') && (!iconConfig.hold_action || iconConfig.hold_action.action === 'none') && (!iconConfig.double_tap_action || iconConfig.double_tap_action.action === 'none');

    return html`
      <div
        class="icon ${classMap({ 'has-picture': hasPicture, 'no-action': noAction })}"
        style=${styleMap({ 'background-image': `${backgroundImage}` })}
      >
        <icon-background></icon-background>
        <ha-icon
          tabindex="-1"
          data-domain=${computeStateDomain(ctrl.stateObj)}
          data-state=${ifDefined(ctrl.stateObj ? ctrl.state : undefined)}
          .icon=${ctrl.icon}
        ></ha-icon>
      </div>
    `;
  }

  private _renderText(): TemplateResult {
    const { config, ctrl, hass } = this;
    if (!config.show_name && !config.show_state && !config.show_attribute) return html``;
    
    return html`
      <div class="text">
        ${config.show_name ? html`<div class="name">${ctrl.name}</div>` : ''}
        ${config.show_state || config.show_attribute ? html`
          <span class="oneliner">
            ${config.show_state ? html`
                  <span class="state">
                    ${ctrl.isUnavailable ? html`${hass.localize('state.default.unavailable')}` : html`${ctrl.label}`}
                  </span>
                ` : ''}
            ${config.show_attribute ? html`
                  <span class="attribute">
                    ${config.show_state && ctrl.attributeLabel ? html` · ` : ''}
                    ${ctrl.attributeLabel}
                  </span>
                ` : ''}
          </span>
        ` : ''}
      </div>
    `;
  }

  private _renderAction(): TemplateResult {
    const { config } = this;
    if (config.action_button?.show === false) return html``;
    return html`
      <div class="action">
        <ha-icon tabindex="-1" .icon=${config.action_button?.icon || 'mdi:power'}></ha-icon>
      </div>
    `;
  }


  /*#############################################
  #                                             #
  #    action button and icon click behavior    #
  #                                             #
  #############################################*/

  private _bindClickActions(element: any, config: any): void {
    if (element._eventsBound) return;
    element._eventsBound = true;

    let isDown = false;

    element.addEventListener("pointerdown", () => {
      isDown = true;
      this.holdTimer = window.setTimeout(() => {
        if (!isDown) return;
        this._handleAction({ detail: { action: "hold" } } as any, config);
        this.holdTimer = null;
      }, this.HOLD_TIME);
    });

    element.addEventListener("pointerleave", () => {
      isDown = false;
      if (this.holdTimer) {
        clearTimeout(this.holdTimer);
        this.holdTimer = null;
      }
    });

    element.addEventListener("pointerup", () => {
      if (!isDown) return;
      isDown = false;
      const now = Date.now();
      const wasHeld = !this.holdTimer;
      if (this.holdTimer) {
        clearTimeout(this.holdTimer);
        this.holdTimer = null;
      }
      if (wasHeld) return;

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
    if (this.lastPointerId !== event.pointerId || this.ctrl.isSliderDisabled || !this.slider.hasPointerCapture(event.pointerId)) {
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
    if (this.lastPointerId !== event.pointerId) {
      return;
    }

    this.slider.style.cursor = 'pointer';
    this.setStateValue(this.ctrl.targetValue);
    this.slider.releasePointerCapture(event.pointerId);
    this.ctrl.originalValueLock = false;
    this.ctrl.clickPositionLock = false;
    this.lastPointerId = null;

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
    if (this.lastPointerId !== event.pointerId) {
      return;
    }

    this.slider.style.cursor = 'pointer';
    this.everLeftMaxDist = false;
    this.updateValue(this.ctrl.value, false);
    this.slider.releasePointerCapture(event.pointerId);
    this.ctrl.originalValueLock = false;
    this.ctrl.clickPositionLock = false;
    this.lastPointerId = null;
  }

  static get styles(): CSSResultGroup {
    return css`
      overflow_fix {
        overflow: hidden; 
      }
      ha-card {
        box-sizing: border-box;
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        touch-action: pan-y;
        line-height: 0;
      }
      :host {
        --slider-bg-default-color: var(--primary-color, rgb(95, 124, 171));
        --slider-bg: var(--slider-color);
        --slider-bg-filter: brightness(100%);
        --slider-bg-direction: to right;
        --slider-value: 0%;
        --slider-transition-duration: 1s;      
        --icon-filter: brightness(100%);
        --icon-color: var(--paper-item-icon-color);
        --btn-bg-color-off: rgba(43,55,78,1);
        --btn-bg-color-on: #20293c;
      }
      .button {
        position: relative;
        padding: 0.8rem;
        box-sizing: border-box;
        height: 100%;
        width: 100%;
        display: block;
        border-radius: calc(var(--ha-card-border-radius, 12px) - var(--ha-card-border-width, 1px));
        mask-image: radial-gradient(white, black);
        transition: all 0.2s ease-in-out;
        touch-action: pan-y;
      }
      .slider[data-mode="top-bottom"],
      .slider[data-mode="bottom-top"] {
        touch-action: none;
      }
      ha-card.compact .button {
        padding: 10px;
      }
      .icon {
        position: relative;
        cursor: pointer;
        width: 36px;
        height: 36px;
        box-sizing: border-box;
        padding: 0;
        outline: none;
        animation: var(--icon-rotate-speed, 0s) linear 0s infinite normal both running rotate;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        -webkit-tap-highlight-color: transparent;
      }
      .icon icon-background {
        background-color: var(--icon-bg-color);
        width: 100%;
        height: 100%;
        position: absolute;
        transition: background-color var(--slider-transition-duration);
      }
      .icon ha-icon {
        filter: var(--icon-filter, brightness(100%));
        color: var(--icon-color);
        transition: color var(--slider-transition-duration), filter var(--slider-transition-duration);
      }
      .icon.has-picture {
        background-size: cover;
        border-radius: 50%;
      }
      .icon.has-picture ha-icon{
        display: none;
      }
      .icon.no-action{
        pointer-events: none;
      }
      .unavailable .icon ha-icon {
        color: var(--disabled-text-color);
      }
      .compact .icon {
        float: left;
      }
      .text {
        position: relative;
        padding-top: inherit;
        pointer-events: none;
        user-select: none;
        font-size: var(--ha-font-size-m);
        line-height: 1.3rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        white-space: nowrap;
        text-shadow: var(--state-text-shadow);
      }
      .compact .text {
        height: 36px;
        left: 0.5rem;
        padding: 0;
      }
      .name {
        color: var(--label-color-on, var(--primary-text-color, white));
        text-shadow: var(--label-text-shadow, none);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .off .name {
        color: var(--label-color-off, var(--primary-text-color, white));
      }
      .unavailable.off .name,
      .unavailable .name {
        color: var(--disabled-text-color);
      }
      .compact .name {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: .1px;
        color: var(--primary-text-color);
      }
      .state {
        transition: font-size 0.1s ease-in-out;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .changing .state {
        font-size: 15px;
      }
      .off .state {
        color: var(--state-color-off, var(--disabled-text-color));
      }
      .unavailable .state {
        color: var(--disabled-text-color);
      }
      .oneliner {      
        color: var(--primary-text-color);
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        height: 16px;
        letter-spacing: .4px;
        display: block;
        overflow: hidden;
      }
      .slider {
        position: absolute;      
        top: 0px;
        left: 0px;
        height: 100%;
        width: 100%;
        background-color: var( --ha-card-background, var(--card-background-color, var(--btn-bg-color-on, black)) );
        cursor: pointer;
        z-index: 0;
      }
      .slider .toggle-overlay {
        position: absolute;      
        top: 0px;
        left: 0px;
        height: 100%;
        width: 100%;
        opacity: 0;
        z-index: 999;    
      }
      .slider-bg {       
        position: absolute;
        top: 0;
        left: 0px;
        height: 100%;
        width: 100%;
        background: var(--slider-bg);
        background-size: var(--slider-bg-size, 100% 100%);
        background-color: var(--slider-bg-color, transparent);
        background-position: var(--slider-bg-position, 0 0);
        filter: var(--slider-bg-filter, brightness(100%));
        transition: background-color var(--slider-transition-duration);
      }
      .slider[data-background="solid"] .slider-bg {            
        --slider-bg-color: var(--slider-color);
      }
      .slider[data-background="triangle"] .slider-bg {      
        --slider-bg-direction: to bottom right;    
        --slider-bg: linear-gradient(var(--slider-bg-direction), transparent 0%, transparent 50%, var(--slider-color) 50%, var(--slider-color) 100%);
        border-right: 0px solid;
      }    
      .slider[data-background="triangle"][data-mode="right-left"] .slider-bg {
        --slider-bg-direction: to bottom left;
      }
      .slider[data-background="triangle"][data-mode="bottom-top"] .slider-bg {
        --slider-bg-direction: to top left;      
      }    
      .slider[data-background="triangle"][data-mode="top-bottom"] .slider-bg {
        --slider-bg-direction: to bottom left;      
      }
      .slider[data-background="custom"] .slider-bg {    
        --slider-bg: repeating-linear-gradient(-45deg, var(--slider-color) 0, var(--slider-color) 1px, var(--slider-color) 0, transparent 10%);
        --slider-bg-size: 30px 30px;
      }    
      .slider[data-background="gradient"] .slider-bg {
        --slider-bg: linear-gradient(var(--slider-bg-direction), rgba(0, 0, 0, 0) -10%, var(--slider-color) 100%);
      }    
      .slider[data-background="striped"] .slider-bg {
        --slider-bg: linear-gradient(var(--slider-bg-direction), var(--slider-color), var(--slider-color) 50%, transparent 50%, transparent);
        --slider-bg-size: 4px 100%;
      }
      .slider[data-background="striped"][data-mode="bottom-top"] .slider-bg,
      .slider[data-background="striped"][data-mode="top-bottom"] .slider-bg {      
        --slider-bg-size: 100% 4px;
      }    
      .slider[data-mode="right-left"] .slider-bg {
        --slider-bg-direction: to left;      
      }    
      .slider[data-mode="bottom-top"] .slider-bg {
        --slider-bg-direction: to top;      
      }    
      .slider[data-mode="top-bottom"] .slider-bg {
        --slider-bg-direction: to bottom;      
      }
      .slider-thumb {
        position: relative;
        width: 100.5%;
        height: 100.5%;      
        transform: translateX(var(--slider-value));
        background: transparent;
        transition: transform var(--slider-transition-duration);
      }
      .changing .slider .slider-thumb {
        transition: none;
      }    
      .slider[data-mode="right-left"] .slider-thumb {
        transform: translateX(calc(var(--slider-value) * -1))  !important;
      }
      .slider[data-mode="top-bottom"] .slider-thumb {
        transform: translateY(var(--slider-value)) !important;
      }
      .slider[data-mode="bottom-top"] .slider-thumb {
        transform: translateY(calc(var(--slider-value) * -1))  !important;
      }
      .slider-thumb:before {
        content: '';
        position: absolute;
        top: 0;
        left: -2px;
        height: 100%;
        width: 2px;          
        background: var(--slider-color);
        opacity: 0;       
        transition: opacity 0.2s ease-in-out 0s;   
        box-shadow: var(--slider-color) 0px 1px 5px 1px;
        z-index: 999;
      }
      .slider[data-mode="top-bottom"] .slider-thumb:before {
        top: -2px;
        left: 0px;
        height: 2px;
        width: 100%;              
      }
      .slider[data-mode="right-left"] .slider-thumb:before {
        left: auto;
        right: -2px;
      }
      .slider[data-mode="bottom-top"] .slider-thumb:before {
        top: auto;
        bottom: -2px;
        left: 0px;
        height: 2px;
        width: 100%;
      }
      .changing .slider-thumb:before {
        opacity: 0.5;    
      }
      .off.changing .slider-thumb:before {
        opacity: 0;    
      }
      .slider-thumb:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0px;
        height: 100%;
        width: 100%;          
        background: var( --ha-card-background, var(--card-background-color, var(--btn-bg-color-on, black)) );
        opacity: 1;            
      }
      .slider[data-show-track="true"] .slider-thumb:after {
        opacity: 0.9;
      }
      .off .slider[data-show-track="true"] .slider-thumb:after {
        opacity: 1;
      }
      .action {
        position: relative;
        float: right;
        width: 36px;
        height: 36px;
        cursor: pointer;
        outline: none;
        display: flex;
        justify-content: center;
        align-items: center;
        -webkit-tap-highlight-color: transparent;
        --mdc-icon-size: 26px;
      }
      .off .action {
        color: var(--action-icon-color-off, var(--paper-item-icon-color, black));
      }
      .unavailable .action {
        color: var(--disabled-text-color);
      }
      .mobile-vertical-scroll-helper {
        position: absolute;
        top: 0;
        left: 0;
        width: 56px;
        height: 100%;
      }
      @media (hover: hover) {
        .mobile-vertical-scroll-helper {
          pointer-events: none;
        }
      }
    `;
  }
}
