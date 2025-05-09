/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionHandlerEvent, applyThemesOnElement, computeStateDomain, handleAction, hasConfigOrEntityChanged, HomeAssistant, LovelaceCard, LovelaceCardEditor, STATES_OFF} from 'custom-card-helpers';
import copy from 'fast-copy';
import { css, CSSResult, customElement, eventOptions, html, LitElement, property, PropertyValues, query, state, TemplateResult } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { ifDefined } from 'lit-html/directives/if-defined';
import { styleMap } from 'lit-html/directives/style-map';
import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';
import { Controller } from './controllers/controller';
import { ControllerFactory } from './controllers/get-controller';
import './editor';
import { localize, setLanguage } from './localize/localize';

import type { SliderButtonCardConfig } from './types';
import { ActionButtonConfigDefault, ActionButtonMode, IconConfigDefault, SliderDirection } from './types';
import { getSliderDefaultForEntity, normalize } from './utils';

/* eslint no-console: 0 */
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
  private actionTimeout;
  private hasSlid = false;

  private readonly DEADZONE_THRESHOLD = 15; // pixels
  private startX = 0;
  private startY = 0;

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('slider-button-card-editor');
  }

  public static getStubConfig(hass: HomeAssistant, entities: string[]): object {
    const entity = entities.find(item => item.startsWith('light')) || '';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const dummy = hass;
    return {
      entity: entity,
      slider: getSliderDefaultForEntity(entity),
      // eslint-disable-next-line @typescript-eslint/camelcase
      show_name: true,
      // eslint-disable-next-line @typescript-eslint/camelcase
      show_state: true,
      compact: false,
      icon: copy(IconConfigDefault),
      // eslint-disable-next-line @typescript-eslint/camelcase
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
      // eslint-disable-next-line @typescript-eslint/camelcase
      show_name: true,
      // eslint-disable-next-line @typescript-eslint/camelcase
      show_state: true,
      compact: false,
      // eslint-disable-next-line @typescript-eslint/camelcase
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
    this.animateActionEnd();
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
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
  }

  protected render(): TemplateResult | void {
    this.ctrl.hass = this.hass;
    if (!this.ctrl.stateObj) {
      return this._showError(localize('common.show_error'));
    }
    return html`
    <div style="overflow:hidden">
      <ha-card
        tabindex="0"
        .label=${`SliderButton: ${this.config.entity || 'No Entity Defined'}`}
        class="${classMap({ 'square': this.config.slider?.force_square || false, 'hide-name': !this.config.show_name, 'hide-state': !this.config.show_state, 'hide-action': !this.config.action_button?.show , 'compact': this.config.compact === true })}"
        data-mode="${this.config.slider?.direction}"
      >
        <div class="button
              ${classMap({ off: this.ctrl.isOff, unavailable: this.ctrl.isUnavailable })}"
              data-mode="${this.config.slider?.direction}"
              style=${styleMap({
                '--slider-value': `${this.ctrl.percentage}%`,
                '--slider-bg-filter': this.ctrl.style.slider.filter,
                '--slider-color': this.ctrl.style.slider.color,
                '--icon-filter': this.ctrl.style.icon.filter,
                '--icon-color': this.ctrl.style.icon.color,
              })}
             >
          <div class="slider"
               @action=${ (e): void => this._sliderAction(e, this.config.slider)}
                .actionHandler=${actionHandler({
                  hasHold: true,
                  hasDoubleClick: true,
                })}
               data-show-track="${this.config.slider?.show_track}"
               data-mode="${this.config.slider?.direction}"
               data-background="${this.config.slider?.background}"
               data-disable-sliding="${this.ctrl.disableSliding}"
               @pointerdown=${this.onPointerDown}
               @pointermove=${this.onPointerMove}
               @pointerup=${this.onPointerUp}
               @pointercancel=${this.onPointerCancel}
          >
            ${this.ctrl.disableSliding //keeping this for the CSS cursor change
              ? html`
                <div class="toggle-overlay"></div>
                `
              : ''}
            <div class="slider-bg"></div>
            <div class="slider-thumb"></div>           
          </div>
          ${this.renderScrollHelper()}
          ${this.renderAction()}
          ${this.renderIcon()}
          ${this.renderText()}
        </div>
      </ha-card>
    </div>
    `;
  }

  private renderScrollHelper(): TemplateResult {
    const isVertical = this.config.slider?.direction === SliderDirection.TOP_BOTTOM
      || this.config.slider?.direction === SliderDirection.BOTTOM_TOP;
    
    if (isVertical)
      return html`<div class="mobile-vertical-scroll-helper"></div>`
    else
      return html``
  }

  private renderIcon(): TemplateResult {
    if (this.config.icon?.show === false) {
      return html``;
    }
    let hasPicture = false;
    let backgroundImage = '';
    if (this.ctrl.stateObj.attributes.entity_picture) {
      backgroundImage = `url(${this.ctrl.stateObj.attributes.entity_picture})`;
      hasPicture = true;
    }

    // Check if all actions are undefined or 'none'
    const iconConfig = this.config.icon || {};
    const noAction = (
      (!iconConfig.tap_action || iconConfig.tap_action.action === 'none') &&
      (!iconConfig.hold_action || iconConfig.hold_action.action === 'none') &&
      (!iconConfig.double_tap_action || iconConfig.double_tap_action.action === 'none')
    );

    return html`
      <div class="icon ${classMap({ 'has-picture': hasPicture, 'no-action': noAction })}"
           @action=${ (e): void => this._handleAction(e, this.config.icon)}
           .actionHandler=${actionHandler({
             hasHold: false,
             hasDoubleClick: false,
           })}
           style=${styleMap({
             'background-image': `${backgroundImage}`,
           })}
           >
        <icon-background></icon-background>
        <ha-icon
          tabindex="-1"
          data-domain=${computeStateDomain(this.ctrl.stateObj)}
          data-state=${ifDefined(
            this.ctrl.stateObj ? this.ctrl.state : undefined
          )}          
          .icon=${this.ctrl.icon}
        />
      </div>
    `;
  }

  private renderText(): TemplateResult {
    if (!this.config.show_name && !this.config.show_state && !this.config.show_attribute) {
      return html``;
    }
    return html`
          <div class="text">
            ${this.config.show_name
              ? html`
                <div class="name">${this.ctrl.name}</div>
                `
              : ''}

              <span class="oneliner">
              ${this.config.show_state
                ? html`
                  <span class="state">
                    ${this.ctrl.isUnavailable
                    ? html`
                      ${this.hass.localize('state.default.unavailable')}
                      ` : html`
                      ${this.ctrl.label}
                    `}
                  </span>
                  `
                  : ''}

              ${this.config.show_attribute
                ? html`
                  <span class="attribute">
                  ${this.config.show_state && this.ctrl.attributeLabel
                    ? html `  ·  `
                    : ''}
                ${this.ctrl.attributeLabel}
                  </span>
                `
                : ''}
              </span>
          </div>
    `;
  }

  private renderAction(): TemplateResult {
    if (this.config.action_button?.show === false) {
      return html``;
    }
    if (this.config.action_button?.mode === ActionButtonMode.TOGGLE) {
      return html`
        <div class="action">
          <ha-switch
            .disabled=${this.ctrl.isUnavailable}
            .checked=${!STATES_OFF.includes(this.ctrl.state)}
            @change=${this._toggle}
          ></ha-switch>
        </div>
      `;
    }
    return html`
      <div class="action"
           @action=${ (e): void => this._handleAction(e, this.config.action_button)}
           .actionHandler=${actionHandler({
             hasHold: false,
             hasDoubleClick: false,
           })}           
           >
        <ha-icon
          tabindex="-1"
          .icon=${this.config.action_button?.icon || 'mdi:power'}
        ></ha-icon>
        ${typeof this.config.action_button?.show_spinner === 'undefined' || this.config.action_button?.show_spinner 
          ? html`
            <svg class="circular-loader" viewBox="25 25 50 50">
              <circle class="loader-path" cx="50" cy="50" r="20"></circle>
            </svg>
                `
          : ''}
      </div>
    `;
  }

  private _handleAction(ev: ActionHandlerEvent, config): void {
    if (this.hass && this.config && ev.detail.action) {
      if (config.tap_action?.action === 'toggle' && !this.ctrl.isUnavailable) {
        this.animateActionStart();
      }
      handleAction(this, this.hass, {...config, entity: this.config.entity}, ev.detail.action);
    }
  }

  private _sliderAction(ev: ActionHandlerEvent, config): void {
    if (this.hasSlid){return;}
    if (this.hass && this.config && ev.detail.action) {
      let actionConfig;
      switch(ev.detail.action) {
        case 'hold':
          console.log("hold");
          actionConfig = config.hold_action || config.tap_action;
          break;
        case 'double_tap':
          console.log("double_tap");
          actionConfig = config.double_tap_action || config.tap_action;
          break;
        default:
          console.log("default");
          actionConfig = config.tap_action;
      }
  
      if (actionConfig?.action === 'toggle' && !this.ctrl.isUnavailable) {
        this.animateActionStart();
      }
      handleAction(this, this.hass, {...config, entity: this.config.entity}, ev.detail.action);
    }
  }

  private _toggle(): void {
    if (this.hass && this.config) {
      // eslint-disable-next-line @typescript-eslint/camelcase
      handleAction(this, this.hass, {tap_action: {action: 'toggle'}, entity: this.config.entity}, 'tap');
    }
  }

  private setStateValue(value: number): void {
    this.ctrl.log('setStateValue', value);
    this.updateValue(value, false);
    this.ctrl.value = value;
  }

  private animateActionStart(): void {
    this.animateActionEnd();
    if (this.action) {
      this.action.classList.add('loading');
    }
  }

  private animateActionEnd(): void {
    if (this.action) {
      clearTimeout(this.actionTimeout);
      this.actionTimeout = setTimeout(()=> {
        this.action.classList.remove('loading');
      }, 750)
    }
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
    this.button.style.setProperty('--icon-rotate-speed', this.ctrl.style.icon.rotateSpeed || '0s');
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

  @eventOptions({passive: true})
  private onPointerDown(event: PointerEvent): void {
    if (this.config.slider?.direction === SliderDirection.TOP_BOTTOM
      || this.config.slider?.direction === SliderDirection.BOTTOM_TOP) {
        event.preventDefault();
      }
    event.stopPropagation();
    if (this.ctrl.isSliderDisabled) {
      return;
    }
    this.slider.setPointerCapture(event.pointerId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let oldPercentage;
    if (this.ctrl.originalValueLock != true) {
      this.ctrl.originalValue = this.ctrl.value;
      this.ctrl.originalValueLock = true;
    }
    this.hasSlid = false;
    // eslint-disable-next-line prefer-const
    oldPercentage = this.ctrl.originalValue;

    this.startX = event.clientX;
    this.startY = event.clientY;
  }

  @eventOptions({passive: true})
  private onPointerUp(event: PointerEvent): void {
    if (this.ctrl.isSliderDisabled) {
      return;
    }

    this.setStateValue(this.ctrl.targetValue);
    this.slider.releasePointerCapture(event.pointerId);
    this.ctrl.originalValueLock = false;
    this.ctrl.clickPositionLock = false;
  }

  private onPointerCancel(event: PointerEvent): void {
    if (this.config.slider?.direction === SliderDirection.TOP_BOTTOM
      || this.config.slider?.direction === SliderDirection.BOTTOM_TOP) {
        return;
      }
    this.updateValue(this.ctrl.value, false);
    this.slider.releasePointerCapture(event.pointerId);
    this.ctrl.originalValueLock = false;
    this.ctrl.clickPositionLock = false;
  }

  @eventOptions({passive: true})
  private onPointerMove(event: any): void {
    if (this.ctrl.isSliderDisabled) {
      return;
    }

    const isVertical = this.config.slider?.direction === SliderDirection.TOP_BOTTOM
      || this.config.slider?.direction === SliderDirection.BOTTOM_TOP;

    const deltaPixel = Math.abs(
      isVertical ? event.clientY - this.startY : event.clientX - this.startX
    );

    if (!this.hasSlid && (deltaPixel > this.DEADZONE_THRESHOLD)) {
      this.hasSlid = true;
    }
    
    if (!this.slider.hasPointerCapture(event.pointerId)) return;
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

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  static get styles(): CSSResult {
    return css`
    ha-card {
      box-sizing: border-box;
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      touch-action: pan-y;
      background: var(--ha-card-border-color,var(--divider-color,#e0e0e0));;
      /* overflow: hidden;         still needed or else the slider will trigger scroll bar when it leaves hui-view even though it's invisible */
      line-height: 0;
    }
    ha-card.square {
      aspect-ratio: 1 / 1;
    }
      
    :host {
      --slider-bg-default-color: var(--primary-color, rgb(95, 124, 171));
      --slider-bg: var(--slider-color);
      --slider-bg-filter: brightness(100%);
      --slider-bg-direction: to right;
      --slider-track-color: #2b374e; 
      --slider-tracker-color: transparent;
      --slider-value: 0%;
      --slider-transition-duration: 1s;      
      /*--label-text-shadow: rgb(255 255 255 / 10%) -1px -1px 1px, rgb(0 0 0 / 50%) 1px 1px 1px;*/
      /*--label-color-on: var(--primary-text-color, white);*/
      /*--label-color-off: var(--primary-text-color, white);*/
      --icon-filter: brightness(100%);
      --icon-color: var(--paper-item-icon-color);
      --icon-rotate-speed: 0s;
      /*--state-color-on: #BAC0C6; */
      /*--state-color-off: var(--disabled-text-color);*/
      /*--state-text-shadow: rgb(255 255 255 / 10%) -1px -1px 1px, rgb(0 0 0 / 50%) 1px 1px 1px;*/
      --btn-bg-color-off: rgba(43,55,78,1);
      --btn-bg-color-on: #20293c;
      /*--action-icon-color-on: var(--paper-item-icon-color, black);*/
      /*--action-icon-color-off: var(--paper-item-icon-color, black);*/      
      /*--action-spinner-color: var(--label-badge-text-color, white);*/
    }
    /* --- BUTTON --- */
    
    .button {
      position: relative;
      padding: 0.8rem;
      box-sizing: border-box;
      height: 100%;
      width: 100%;
      display: block;
      border-radius: calc(var(--ha-card-border-radius) - var(--ha-card-border-width, 1px));
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
    
    /* --- ICON --- */
    
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
      background-color: var(--icon-color);
      opacity: 0.2;
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

    /* --- TEXT --- */
    
    .text {
      position: relative;
      padding-top: inherit;
      pointer-events: none;
      user-select: none;
      font-size: 1.1rem;
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

    /* --- LABEL --- */
    
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
    
    /* --- STATE --- */
    
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
      /* color: var(--state-color-on, var(--label-badge-text-color, white)); */
      color: var(--primary-text-color);
      font-weight: 400;
      font-size: 12px;
      line-height: 16px;
      height: 16px;
      letter-spacing: .4px;
      display: block;
      overflow: hidden;
    }
    
    /* --- SLIDER --- */    
    
    .slider {
      position: absolute;      
      top: 0px;
      left: 0px;
      height: 100%;
      width: 100%;
      background-color: var( --ha-card-background, var(--card-background-color, var(--btn-bg-color-on, black)) );
      cursor: ew-resize;
      z-index: 0;
    }
    .slider[data-mode="bottom-top"] {
      cursor: ns-resize;     
    }
    .slider[data-mode="top-bottom"] {
      cursor: ns-resize;
    }
    .slider:active {
      cursor: grabbing;
    }
    
    /* --- SLIDER OVERLAY --- */      
      
    .slider .toggle-overlay {
      position: absolute;      
      top: 0px;
      left: 0px;
      height: 100%;
      width: 100%;
      cursor: pointer;
      opacity: 0;
      z-index: 999;    
    }
    
    /* --- SLIDER BACKGROUND --- */   
     
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
    
    /* --- SLIDER THUMB --- */
    
    .slider-thumb {
      position: relative;
      width: 100.5%;  /* + 0.5 firefox... */
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
                  
    /* --- ACTION BUTTON --- */      
              
    .action {
      position: relative;
      float: right;
      width: 36px;
      height: 36px;
      /* color: var(--action-icon-color-on, var(--paper-item-icon-color, black)); */
      cursor: pointer;
      outline: none;
      display: flex;
      justify-content: center;
      align-items: center;
      -webkit-tap-highlight-color: transparent;
      --mdc-icon-size: 26px;
    }    
    .action ha-switch {
    }    
    .off .action {
      color: var(--action-icon-color-off, var(--paper-item-icon-color, black));
    }
    .unavailable .action {
      color: var(--disabled-text-color);
    }
    

    .circular-loader {
      position: absolute;
      width: calc(var(--mdc-icon-size, 24px) + 16px);
      height: calc(var(--mdc-icon-size, 24px) + 16px);
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
      animation: rotate 2s linear infinite; 
    }   
    .action.loading .circular-loader {
      opacity: 1;      
    }    

    .loader-path {
      fill: none;
      stroke-width: 2px;
      stroke: var(--action-spinner-color, var(--label-badge-text-color, white));
      animation: animate-stroke 1.5s ease-in-out infinite both;        
      stroke-linecap: round;
    }
    
    /* --- MISC --- */    
    
    .unavailable .slider .toggle-overlay,
    .unavailable .action,
    .unavailable .action ha-switch,    
    .unavailable .slider {
      cursor: not-allowed !important;
    }
    
    
    @keyframes rotate {
      100% {
        transform: rotate(360deg);
      }
    }
    
    @keyframes animate-stroke {
      0% {
        stroke-dasharray: 1, 200;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 89, 200;
        stroke-dashoffset: -35;
      }
      100% {
        stroke-dasharray: 89, 200;
        stroke-dashoffset: -124;
      }
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
