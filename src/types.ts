/* eslint-disable @typescript-eslint/camelcase */
import { ActionConfig, LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'slider-button-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

export interface SliderButtonCardConfig extends LovelaceCardConfig {
  type: string;
  entity: string;
  attribute?: string;
  name?: string;
  show_name?: boolean;
  show_state?: boolean;
  show_attribute?: boolean;
  icon?: IconConfig;
  action_button?: ActionButtonConfig;
  slider?: SliderConfig;
  theme?: string;
  debug?: boolean;
  compact?: boolean;
}

export interface ActionButtonConfig {
  icon?: string;
  show?: boolean;
  show_spinner?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface IconConfig {
  icon?: string;
  show?: boolean;
  use_brightness?: boolean;
  color_mode?: ColorMode;
  color?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface SliderConfig {
  min?: number;
  max?: number;
  min_value?: number;
  max_value?: number;
  step?: number;
  attribute?: string;
  direction?: SliderDirection;
  background: SliderBackground;
  use_brightness?: boolean;
  color_mode?: ColorMode;
  color?: string;
  show_track?: boolean;
  disable_sliding?: boolean;
  invert?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export enum ActionButtonMode {
  TOGGLE = 'toggle',
  CUSTOM = 'custom',
}

export enum SliderDirection {
  LEFT_RIGHT = 'left-right',
  RIGHT_LEFT = 'right-left',
  TOP_BOTTOM = 'top-bottom',
  BOTTOM_TOP = 'bottom-top',
}

export enum SliderBackground {
  SOLID = 'solid',
  GRADIENT = 'gradient',
  TRIANGLE = 'triangle',
  STRIPED = 'striped',
  CUSTOM = 'custom',
}

export enum ColorMode {
  DEFAULT = 'default',
  STATE = 'state',
  CUSTOM = 'custom',
}

export enum Domain {
  LIGHT = 'light',
  SWITCH = 'switch',
  FAN = 'fan',
  COVER = 'cover',
  INPUT_BOOLEAN = 'input_boolean',
  INPUT_NUMBER = 'input_number',
  MEDIA_PLAYER = 'media_player',
  NUMBER = 'number',
  CLIMATE = 'climate',
  LOCK = 'lock',
  AUTOMATION = 'automation',
}

export enum LightAttributes {
  COLOR_TEMP = 'color_temp',
  BRIGHTNESS = 'brightness',
  BRIGHTNESS_PCT = 'brightness_pct',
  HUE = 'hue',
  SATURATION = 'saturation',
  ON_OFF = 'onoff',
}

export enum LightColorModes {
  COLOR_TEMP = 'color_temp',
  BRIGHTNESS = 'brightness',
  HS = 'hs',
  ON_OFF = 'onoff',
}

export enum CoverAttributes {
  POSITION = 'position',
  TILT = 'tilt',
}

export const ActionButtonConfigDefault: ActionButtonConfig = {
  icon: 'mdi:power',
  show: false,
  show_spinner: false,
  tap_action: {
    action: 'toggle'
  },
};

export const IconConfigDefault: IconConfig = {
  show: true,
  color_mode: ColorMode.DEFAULT,
  use_brightness: false,
  tap_action: {
    action: 'more-info'
  },
};

export const SliderConfigDefault: SliderConfig = {
  direction: SliderDirection.LEFT_RIGHT,
  background: SliderBackground.SOLID,
  use_brightness: false,
  color_mode: ColorMode.DEFAULT,
  show_track: false,
  disable_sliding: false,
  tap_action: {
    action: 'toggle'
  },
};

export const SliderConfigDefaultDomain: Map<string, SliderConfig> = new Map([
  [Domain.LIGHT, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.GRADIENT,
    color_mode: ColorMode.STATE,
    use_brightness: true,
    show_track: false,
    disable_sliding: false,
    show_attribute: false,
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.FAN, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.SOLID,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    show_track: false,
    disable_sliding: false,
    show_attribute: false,
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.SWITCH, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.SOLID,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    show_track: false,
    disable_sliding: true,
    force_square: false,
    show_attribute: false,
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.AUTOMATION, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.SOLID,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    show_track: false,
    toggle_on_click: true,
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.COVER, {
    direction: SliderDirection.TOP_BOTTOM,
    background: SliderBackground.STRIPED,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    disable_sliding: false,
    show_track: false,
    invert: true,
    show_attribute: false,
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.INPUT_BOOLEAN, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.SOLID,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    show_track: false,
    disable_sliding: false,
    show_attribute: false,
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.INPUT_NUMBER, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.SOLID,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    show_track: false,
    toggle_on_click: false,
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.MEDIA_PLAYER, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.TRIANGLE,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    show_track: true,
    disable_sliding: false,
    show_attribute: true,
    attribute: "media_title",
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.LOCK, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.SOLID,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    show_track: false,
    disable_sliding: true,
    show_attribute: false,
    tap_action: {
      action: 'toggle'
    },
  }],
  [Domain.CLIMATE, {
    direction: SliderDirection.LEFT_RIGHT,
    background: SliderBackground.TRIANGLE,
    color_mode: ColorMode.DEFAULT,
    use_brightness: false,
    show_track: true,
    disable_sliding: false,
    show_attribute: false,
    tap_action: {
      action: 'toggle'
    },
  }],
]);