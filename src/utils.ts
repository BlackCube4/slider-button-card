import { computeDomain } from './ha-helpers';
import { Domain, SliderConfig, SliderConfigDefault, SliderConfigDefaultDomain } from './types';

export function getEnumValues(enumeration): string[] {
  return Object.keys(enumeration).map(key => enumeration[key]).filter(value => typeof value === 'string');
}

export const applyPatch = (data, path, value): void => {
  if (path.length === 1) {
    data[path[0]] = value;
    return;
  }
  if (!data[path[0]]) {
    data[path[0]] = {};
  }
  // eslint-disable-next-line consistent-return
  return applyPatch(data[path[0]], path.slice(1), value);
};

export function getSliderDefaultForEntity(entity: string): SliderConfig {
  const domain = computeDomain(entity) || Domain.LIGHT;
  const cfg = SliderConfigDefaultDomain.get(domain) || SliderConfigDefault;
  return structuredClone(cfg);
}

export function getLightColorBasedOnTemperature(current: number, min: number, max: number): string {
  const mixAmount = ((current - min) / (max - min)) * 100;
  if (mixAmount < 50) {
    const pct = Math.round(mixAmount * 2);
    return `color-mix(in srgb, white ${pct}%, rgb(166, 209, 255))`;
  } else {
    const pct = Math.round((mixAmount - 50) * 2);
    return `color-mix(in srgb, rgb(255, 160, 0) ${pct}%, white)`;
  }
}
 export function toPercentage(value: number, min: number, max: number): number {
  return (((value - min) / (max - min)) * 100);
}

export function percentageToValue(percent: number, min: number, max: number): number {
  return Math.round(
    (percent * (max - min) / 100 + min)
  )
}

export const normalize = (value: number, min: number, max: number): number => {
  if (isNaN(value) || isNaN(min) || isNaN(max)) {
    // Not a number, return 0
    return 0;
  }
  if (value > max) return max;
  if (value < min) return min;
  return value;
};

export const capitalizeFirst = (s): string => (s && s[0].toUpperCase() + s.slice(1)) || "";
