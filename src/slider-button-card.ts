/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
import { ActionHandlerEvent, applyThemesOnElement, computeStateDomain, handleAction, hasConfigOrEntityChanged, HomeAssistant, LovelaceCard, LovelaceCardEditor, STATES_OFF} from 'custom-card-helpers';
import copy from 'fast-copy';
import { customElement, eventOptions, html, LitElement, property, PropertyValues, query, state, TemplateResult, CSSResult, CSSResultArray } from 'lit-element';
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
import { sliderButtonCardStyles } from './slider-button-card-styles';

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
  private actionTimeout;
  private hasSlid = false;

  private readonly DEADZONE_THRESHOLD = 15; // pixels
  private startX = 0;
  private startY = 0;

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
      <overflow_fix>
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
                  hasDoubleClick: !!this.config.slider?.double_tap_action && this.config.slider.double_tap_action.action !== 'none'
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
              ${this.ctrl.disableSliding
                ? html`<div class="toggle-overlay"></div>`
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
      </overflow_fix>
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
          try {
            this.slider.releasePointerCapture?.(this.lastPointerId);
          } catch (e) {}
          actionConfig = config.hold_action;
          break;
        case 'double_tap':
          console.log("double_tap");
          actionConfig = config.double_tap_action;
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
    this.lastPointerId = event.pointerId;
    this.slider.setPointerCapture(event.pointerId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let oldPercentage;
    if (this.ctrl.originalValueLock != true) {
      this.ctrl.originalValue = this.ctrl.value;
      this.ctrl.originalValueLock = true;
    }
    
    // eslint-disable-next-line prefer-const
    oldPercentage = this.ctrl.originalValue;

    this.hasSlid = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
  }

  @eventOptions({passive: true})
  private onPointerUp(event: PointerEvent): void {
    if (this.ctrl.isSliderDisabled) {
      return;
    }

    this.hasSlid = false;
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
    this.hasSlid = false;
    this.updateValue(this.ctrl.value, false);
    this.slider.releasePointerCapture(event.pointerId);
    this.ctrl.originalValueLock = false;
    this.ctrl.clickPositionLock = false;
  }

  @eventOptions({passive: true})
  private onPointerMove(event: any): void {
    if (this.ctrl.isSliderDisabled  || !this.slider.hasPointerCapture(event.pointerId)) {
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
    
    if (this.hasSlid) {
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

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  static get styles(): CSSResult | CSSResultArray {
    return sliderButtonCardStyles;
  }
}
