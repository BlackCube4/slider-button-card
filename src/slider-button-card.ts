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
import { getSliderDefaultForEntity, normalize } from './utils';
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
    return renderSliderButtonCard(this);
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
