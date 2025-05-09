import { computeStateDomain, domainIcon, HomeAssistant } from 'custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';
import { SliderBackground, SliderButtonCardConfig, SliderDirection } from '../types';
import { getLightColorBasedOnTemperature, normalize, percentageToValue, toPercentage } from '../utils';

export interface Style {
  icon: ObjectStyle;
  slider: ObjectStyle;
}

export interface ObjectStyle {
  filter: string;
  color: string;
  rotateSpeed?: string;
}

export abstract class Controller {
  _config: SliderButtonCardConfig;
  _hass: any;

  abstract _value?: number;
  abstract _originalValue?: number;
  abstract _originalValueLock?: boolean;
  abstract _clickPosition?: number;
  abstract _clickPositionLock?: boolean;
  abstract _targetValue?: number;
  abstract _min?: number;
  abstract _max?: number;
  abstract _step?: number;
  abstract _invert?: boolean;

  iconColorBackup: string = 'var(--paper-item-icon-color, #44739e)';
  sliderColorBackup: string = 'var(--paper-item-icon-color, #44739e)';

  protected constructor(config: SliderButtonCardConfig) {
    this._config = config;
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get stateObj(): any {
    return this._hass.states[this._config.entity] as HassEntity;
  }

  get domain(): string {
    return computeStateDomain(this.stateObj);
  }

  get name(): string {
    return this._config.name ? this._config.name : this.stateObj?.attributes?.friendly_name ? this.stateObj.attributes.friendly_name : '';
  }

  get icon(): string {
    if (typeof this._config.icon?.icon === 'string' && this._config.icon?.icon.length) {
      return this._config.icon.icon;
    }
    return this.stateObj.attributes?.icon ? this.stateObj.attributes.icon : domainIcon(this.domain, this.stateObj.state);
  }

  get value(): number {
    if (this._value) {
      return Math.round(this._value / this.step) * this.step;
    }
    return this.min;
  }

  set value(value: number) {
    if (value !== this.value) {
      this._value = value;
      // this._value = Math.round(value / this.step) * this.step;
    }
  }

  set originalValue(value: number) {
    this._originalValue = value;
  }

  get originalValue(): number {
    //return this.originalValue;
    if (this._originalValue === 0) {
      return 0;
    }
    if (this._originalValue) {
      return Math.round(this._originalValue / this.step) * this.step;
    }
    return 0;
  }

  get originalValueLock(): boolean {
    if (this._originalValueLock == true) {
      return true;
    }
    return false;
  }

  set originalValueLock(lock: boolean) {
    this._originalValueLock = lock;
  }

  set clickPosition(value: number) {
    this._clickPosition = value;
  }

  get clickPosition(): number {
    //return this.clickPosition;
    if (this._clickPosition === 0) {
      return 0;
    }
    if (this._clickPosition) {
      return Math.round(this._clickPosition / this.step) * this.step;
    }
    return 0;
  }

  get clickPositionLock(): boolean {
    if (this._clickPositionLock == true) {
      return true;
    }
    return false;
  }

  set clickPositionLock(lock: boolean) {
    this._clickPositionLock = lock;
  }

  get targetValue(): number {
    if (this._targetValue === 0) {
      return 0;
    }
    if (this._targetValue) {
      return Math.round(this._targetValue / this.step) * this.step;
    }
    if (this.value) {
      return this.value;
    }
    return 0;
  }

  set targetValue(value: number) {
    if (value !== this.targetValue) {
      this._targetValue = value;
      // this._targetValue = Math.round(value / this.step) * this.step;
    }
  }

  get label(): string {
    return `${this.targetValue}`;
  }

  get attributeLabel(): string {
    if (this._config.attribute) {
      return this.stateObj.attributes[this._config.attribute];
    }
    return '';
  }

  get hidden(): boolean {
    return false;
  }

  get hasSlider(): boolean {
    return true;
  }

  get disableSliding(): boolean {
    return this._config.slider?.disable_sliding ?? false;
  }

  get toggleValue(): number {
    return this.value === this.min ? this.max : this.min;
  }

  get state(): string {
    return this.stateObj?.state;
  }

  get isOff(): boolean {
    return this.percentage === 0;
  }

  get isUnavailable(): boolean {
    return this.state ? this.state === 'unavailable' : true;
  }

  get isSliderDisabled(): boolean {
    return this.isUnavailable ? this.isUnavailable : this.disableSliding;
  }

  get min(): number {
    return this._config.slider?.min ?? this._min ?? 0;
  }

  get max(): number {
    return this._config.slider?.max ?? this._max ?? 100;
  }

  get step(): number {
    return this._config.slider?.step ?? this._step ?? 5;
  }

  get invert(): boolean {
    return this._config.slider?.invert ?? this._invert ?? false;
  }

  get isValuePercentage(): boolean {
    return true;
  }

  get percentage(): number {
    return Math.round(
      ((this.targetValue - (this.invert ? this.max : this.min)) * 100) / (this.max - this.min) * (this.invert ? -1 : 1)
    );
  }

  get valueFromPercentage(): number {
    return percentageToValue(this.percentage, this.min, this.max);
  }

  get allowedAttributes(): string[] {
    return [];
  }

  get style(): Style {
    return {
      icon: {
        filter: this.iconFilter,
        color: this.iconColor,
        rotateSpeed: this.iconRotateSpeed,
      },
      slider: {
        filter: this.sliderFilter,
        color: this.sliderColor,
      },
    };
  }

  get iconFilter(): string {
    if (this._config.icon?.use_brightness == false || this.percentage === 0) {
      return 'brightness(100%)';
    }
    return `brightness(${(this.percentage + 100) / 2}%)`;
  }

  get iconColor(): string {
    switch(this._config.icon?.color_mode) {
      case 'state':
        if (this.stateObj.attributes.hs_color) {
          const [hue, sat] = this.stateObj.attributes.hs_color;
          this.iconColorBackup = `hsl(${hue}, 100%, ${100 - sat / 2}%)`;
          return this.iconColorBackup;
        }
        return this.percentage == 0
          ? 'var(--paper-item-icon-color, #44739e)'
          : this.iconColorBackup;
      case 'custom':
        return this.percentage == 0 
          ? 'var(--paper-item-icon-color, #44739e)'
          : this._config.icon?.color || 'inherit';
      default:
        return '';
    }
  }

  get iconRotateSpeed(): string {
    return '0s';
  }

  get sliderFilter(): string {
    if (!this._config.slider?.use_brightness || this.percentage === 0 || this._config.slider.background === SliderBackground.GRADIENT) {
      return 'brightness(100%)';
    }
    return `brightness(${(this.percentage + 100) / 2}%)`;
  }

  get sliderColor(): string {
    switch(this._config.slider?.color_mode) {
      case 'state':
        if (this.stateObj.attributes.hs_color) {
          const [hue, sat] = this.stateObj.attributes.hs_color;
          this.sliderColorBackup = `hsl(${hue}, 100%, ${100 - sat / 2}%)`;
          return this.sliderColorBackup;
        } else  if (
          this.stateObj.attributes.color_temp &&
          this.stateObj.attributes.min_mireds &&
          this.stateObj.attributes.max_mireds
        ) {
          this.sliderColorBackup = getLightColorBasedOnTemperature(
            this.stateObj.attributes.color_temp,
            this.stateObj.attributes.min_mireds,
            this.stateObj.attributes.max_mireds,
          );
          return this.sliderColorBackup;
        }
        return this.percentage == 0 && this._config.slider.background == SliderBackground.SOLID
          ? 'var(--paper-item-icon-color, #44739e)'
          : this.sliderColorBackup;
      case 'custom':
        return this.percentage == 0 && this._config.slider.background == SliderBackground.SOLID
          ? 'var(--paper-item-icon-color, #44739e)'
          : this._config.slider?.color || 'inherit';
        
      default:
        return 'inherit';
    }
  }

  moveSlider(event: any, {left, top, width, height}): number {
    let percentage = this.calcMovementPercentage(event, {left, top, width, height});
    percentage = this.applyStep(percentage);
    //percentage = normalize(percentage, 0, 100);
    if (!this.isValuePercentage) {
      percentage = percentageToValue(percentage, this.min, this.max);
    }
    return percentage;
  }

  calcMovementPercentage(event: any, {left, top, width, height}): number {
    let percentage;
    switch(this._config.slider?.direction) {
      case SliderDirection.LEFT_RIGHT:
        percentage = toPercentage(
          event.clientX,
          left,
          width
        );
        if (this.invert) {
          percentage = 100 - percentage;
        }
        break
      case SliderDirection.RIGHT_LEFT:
        percentage = toPercentage(
          event.clientX,
          left,
          width
        );
        if (!this.invert) {
          percentage = 100 - percentage;
        }
        break
      case SliderDirection.TOP_BOTTOM:
        percentage = toPercentage(
          event.clientY,
          top,
          height
        );
        if (this.invert) {
          percentage = 100 - percentage;
        }
        break
      case SliderDirection.BOTTOM_TOP:
        percentage = toPercentage(
          event.clientY,
          top,
          height
        );
        if (!this.invert) {
          percentage = 100 - percentage;
        }
        break

    }
    return percentage;
  }

  applyStep(value: number): number {
    return  Math.round(value / this.step) * this.step;
  }

  log(name = '', value: string | number | object = ''): void {
    if (this._config.debug) {
      console.log(`${this._config.entity}: ${name}`, value)
    }
  }
}
