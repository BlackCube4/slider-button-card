export interface HomeAssistant {
  states: Record<string, any>;
  themes: any;
  language: string;
  localize: (key: string) => string;
  callService: (domain: string, service: string, data?: any) => void;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  getCardSize(): number;
  setConfig(config: any): void;
}

export interface LovelaceCardEditor extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: any): void;
}

export interface LovelaceCardConfig {
  type: string;
  [key: string]: any;
}

export interface ActionConfig {
  action: string;
  navigation_path?: string;
  url_path?: string;
  service?: string;
  service_data?: any;
  target?: any;
  perform_action?: string;
  data?: any;
  entity?: string;
}

export interface ActionHandlerEvent extends Event {
  detail: {
    action: string;
  };
}

export const computeDomain = (entityId: string): string => {
  return entityId ? entityId.split('.')[0] : '';
};

export const computeStateDomain = (stateObj: any): string => {
  return stateObj && stateObj.entity_id ? computeDomain(stateObj.entity_id) : '';
};

export const STATES_OFF = ['closed', 'locked', 'off'];

export const domainIcon = (domain: string, state?: string): string => {
  const icons: Record<string, string> = {
    automation: 'mdi:playlist-play',
    climate: 'mdi:thermostat',
    cover: state === 'open' ? 'mdi:window-open' : 'mdi:window-closed',
    fan: 'mdi:fan',
    input_boolean: 'mdi:toggle-switch-outline',
    input_number: 'mdi:ray-vertex',
    light: 'mdi:lightbulb',
    lock: state === 'unlocked' ? 'mdi:lock-open' : 'mdi:lock',
    media_player: 'mdi:cast',
    number: 'mdi:ray-vertex',
    switch: 'mdi:flash',
  };
  return icons[domain] || 'mdi:bookmark';
};

export const stateIcon = (stateObj: any): string => {
  if (!stateObj) return 'mdi:bookmark';

  if (stateObj.attributes?.icon) {
    return stateObj.attributes.icon;
  }

  const domain = computeStateDomain(stateObj);
  const state = stateObj.state;
  const deviceClass = stateObj.attributes?.device_class;

  if (domain === 'cover') {
    const isOpen = state !== 'closed';
    switch (deviceClass) {
      case 'awning':
        return isOpen ? 'mdi:awning-outline' : 'mdi:awning';
      case 'blind':
      case 'shade':
        return isOpen ? 'mdi:blinds-open' : 'mdi:blinds';
      case 'curtain':
        return isOpen ? 'mdi:curtains' : 'mdi:curtains-closed';
      case 'damper':
        return isOpen ? 'mdi:circle-outline' : 'mdi:circle-slice-8';
      case 'door':
        return isOpen ? 'mdi:door-open' : 'mdi:door-closed';
      case 'garage':
        return isOpen ? 'mdi:garage-open' : 'mdi:garage';
      case 'gate':
        return isOpen ? 'mdi:gate-open' : 'mdi:gate';
    }
  }

  return domainIcon(domain, state);
};

export const fireEvent = (node: HTMLElement, type: string, detail?: any, options?: any): void => {
  options = options || {};
  detail = detail === null || detail === undefined ? {} : detail;
  const event = new CustomEvent(type, {
    detail,
    bubbles: options.bubbles === undefined ? true : options.bubbles,
    composed: options.composed === undefined ? true : options.composed,
    cancelable: options.cancelable === undefined ? true : options.cancelable,
  });
  node.dispatchEvent(event);
};

export const hasConfigOrEntityChanged = (element: any, changedProps: any, forceUpdate: boolean): boolean => {
  if (changedProps.has('config') || forceUpdate) return true;
  if (element.config?.entity) {
    const oldHass = changedProps.get('hass');
    if (oldHass && oldHass.states[element.config.entity] !== element.hass?.states[element.config.entity]) {
      return true;
    }
  }
  return false;
};

export const applyThemesOnElement = (element: HTMLElement, themes: any, localTheme?: string): void => {
  if (!element || !themes) return;
  let themeName = themes.default_theme;
  if (localTheme === "default" || (localTheme && themes.themes[localTheme])) {
    themeName = localTheme;
  }
  const themeVariables = themes.themes[themeName] || {};
  
  const el = element as any;
  if (el._themes) {
    for (const [key] of Object.entries(el._themes)) {
      element.style.removeProperty(key);
    }
  }
  el._themes = {};
  
  for (const [key, value] of Object.entries(themeVariables)) {
    element.style.setProperty(`--${key}`, value as string);
    el._themes[`--${key}`] = value;
  }
};