import { Controller } from './controller';

export class NumberController extends Controller {
  _targetValue;
  _invert = false;
  _clickPosition;
  _clickPositionLock;
  _originalValue;
  _originalValueLock;

  get _value(): number {
    return this.stateObj.state;
  }

  set _value(value) {
    this._hass.callService('number', 'set_value', {
      // eslint-disable-next-line @typescript-eslint/camelcase
      entity_id: this.stateObj.entity_id,
      value: value,
    });
  }

  get _min(): number {
    return this.stateObj.attributes.min;
  }

  get _max(): number {
    return this.stateObj.attributes.max;
  }

  get isValuePercentage(): boolean {
    return false;
  }

  get _step(): number {
    return this.stateObj.attributes.step;
  }

  get label(): string {
    return this.stateObj.attributes.unit_of_measurement ? `${this.targetValue} ${this.stateObj.attributes.unit_of_measurement}` : `${this.targetValue}`;
  }

}
