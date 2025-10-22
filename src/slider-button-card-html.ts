/* eslint-disable @typescript-eslint/no-explicit-any */
import { html, TemplateResult } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { ifDefined } from 'lit-html/directives/if-defined';
import { SliderDirection } from './types';
import { computeStateDomain } from 'custom-card-helpers';


function renderScrollHelper(self: any): TemplateResult {
  const isVertical =
    self.config.slider?.direction === SliderDirection.TOP_BOTTOM ||
    self.config.slider?.direction === SliderDirection.BOTTOM_TOP;

  return isVertical
    ? html`<div class="mobile-vertical-scroll-helper"></div>`
    : html``;
}


function renderIcon(self: any): TemplateResult {
  const { config, ctrl } = self;

  if (config.icon?.show === false) return html``;

  let hasPicture = false;
  let backgroundImage = '';
  if (ctrl.stateObj.attributes.entity_picture) {
    backgroundImage = `url(${ctrl.stateObj.attributes.entity_picture})`;
    hasPicture = true;
  }

  const iconConfig = config.icon || {};
  const noAction =
    (!iconConfig.tap_action || iconConfig.tap_action.action === 'none') &&
    (!iconConfig.hold_action || iconConfig.hold_action.action === 'none') &&
    (!iconConfig.double_tap_action ||
      iconConfig.double_tap_action.action === 'none');

  return html`
    <div
      class="icon ${classMap({
        'has-picture': hasPicture,
        'no-action': noAction,
      })}"
      .actionHandler=${(window as any).actionHandler
        ? (window as any).actionHandler({ hasHold: true, hasDoubleClick: true })
        : undefined}
      @action=${(e: Event): void => self._handleAction(e, config.icon)}
      style=${styleMap({
        'background-image': `${backgroundImage}`,
      })}
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



function renderText(self: any): TemplateResult {
  const { config, ctrl, hass } = self;
  if (!config.show_name && !config.show_state && !config.show_attribute)
    return html``;

  return html`
    <div class="text">
      ${config.show_name ? html`<div class="name">${ctrl.name}</div>` : ''}
      <span class="oneliner">
        ${config.show_state
          ? html`
              <span class="state">
                ${ctrl.isUnavailable
                  ? html`${hass.localize('state.default.unavailable')}`
                  : html`${ctrl.label}`}
              </span>
            `
          : ''}
        ${config.show_attribute
          ? html`
              <span class="attribute">
                ${config.show_state && ctrl.attributeLabel
                  ? html` · `
                  : ''}
                ${ctrl.attributeLabel}
              </span>
            `
          : ''}
      </span>
    </div>
  `;
}



function renderAction(self: any): TemplateResult {
  const { config, ctrl } = self;

  if (config.action_button?.show === false) return html``;

  return html`
    <div
      class="action"
      .actionHandler=${(window as any).actionHandler
        ? (window as any).actionHandler({ hasHold: true, hasDoubleClick: true })
        : undefined}
      @action=${(e: Event): void =>
        self._handleAction(e, config.action_button)}
    >
      <ha-icon
        tabindex="-1"
        .icon=${config.action_button?.icon || 'mdi:power'}
      ></ha-icon>
    </div>
  `;
}



export function renderSliderButtonCard(self: any): TemplateResult {
  const { config, ctrl } = self;

  return html`
    <overflow_fix>
      <ha-card
        tabindex="0"
        .label=${`SliderButton: ${config.entity || 'No Entity Defined'}`}
        class="${classMap({
          square: config.slider?.force_square || false,
          'hide-name': !config.show_name,
          'hide-state': !config.show_state,
          'hide-action': !config.action_button?.show,
          compact: config.compact === true,
        })}"
        data-mode="${config.slider?.direction}"
      >
        <div class="button 
          ${classMap({ off: ctrl.isOff, unavailable: ctrl.isUnavailable, })}"
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
            @action=${(e: Event): void => self._sliderAction(e, config.slider)}
            data-show-track="${config.slider?.show_track}"
            data-mode="${config.slider?.direction}"
            data-background="${config.slider?.background}"
            data-disable-sliding="${ctrl.disableSliding}"
            @pointerdown=${self.onPointerDown}
            @pointermove=${self.onPointerMove}
            @pointerup=${self.onPointerUp}
            @pointercancel=${self.onPointerCancel}
          >
            ${ctrl.disableSliding ? html`<div class="toggle-overlay"></div>` : ''}
            <div class="slider-bg"></div>
            <div class="slider-thumb"></div>
          </div>
          ${renderScrollHelper(self)}
          ${renderAction(self)}
          ${renderIcon(self)}
          ${renderText(self)}
        </div>
      </ha-card>
    </overflow_fix>
  `;
}